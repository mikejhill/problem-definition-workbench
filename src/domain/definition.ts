import { defineDocument, type CommandMetadata } from "@mikejhill/portable-document-core";
import { problemDefinitionCommandSchema, type ProblemDefinitionCommand } from "./commands";
import {
  documentType,
  problemDefinitionDocumentSchema,
  type ProblemDefinitionDocumentV1,
  type ProblemDefinitionSummary,
} from "./model";
import { reduceProblemDefinition } from "./reducer";

function inspectCommand(command: ProblemDefinitionCommand): CommandMetadata {
  switch (command.type) {
    case "patch-metadata": {
      const fields = Object.keys(command.patch).sort();
      return {
        targets: fields.map((field) => `metadata:${field}`),
        coalescingKey: `metadata:${fields.join(",")}`,
        durability: "coalesced",
        conflictLabel: "Document details",
      };
    }
    case "set-narrative":
      return {
        targets: [`narrative:${command.section}`],
        coalescingKey: `narrative:${command.section}`,
        durability: "coalesced",
        conflictLabel: command.section,
      };
    case "update-entity": {
      const fields = Object.keys(command.patch).sort();
      return {
        targets: fields.map((field) => `entity:${command.entityId}:${field}`),
        coalescingKey: `entity:${command.entityId}:${fields.join(",")}`,
        durability: "coalesced",
        conflictLabel: "Model element",
      };
    }
    case "update-note": {
      const fields = Object.keys(command.patch).sort();
      return {
        targets: fields.map((field) => `note:${command.noteId}:${field}`),
        coalescingKey: `note:${command.noteId}:${fields.join(",")}`,
        durability: "coalesced",
        conflictLabel: "Inbox note",
      };
    }
    case "add-entity":
    case "delete-entity":
    case "move-entity":
      return {
        targets: ["entities"],
        durability: "immediate",
        checkpointReason: "Model Structure Changed",
        conflictLabel: "Model structure",
      };
    case "add-relation":
    case "delete-relation":
      return {
        targets: ["relations"],
        durability: "immediate",
        checkpointReason: "Relationships Changed",
        conflictLabel: "Relationships",
      };
    case "add-note":
    case "delete-note":
    case "move-note":
    case "convert-note":
      return command.type === "convert-note"
        ? {
            targets: ["inbox"],
            durability: "immediate",
            checkpointReason: "Inbox Note Converted",
            conflictLabel: "Inbox",
          }
        : { targets: ["inbox"], durability: "immediate", conflictLabel: "Inbox" };
    case "add-attachment":
    case "update-attachment":
    case "delete-attachment":
    case "move-attachment":
      return {
        targets: ["attachments"],
        durability: "immediate",
        checkpointReason: "Source Links Changed",
        conflictLabel: "Source links",
      };
    case "apply-batch":
      return {
        targets: ["document"],
        durability: "immediate",
        checkpointReason: command.label,
        conflictLabel: "AI or bulk proposal",
      };
    case "replace-document":
      return {
        targets: ["document"],
        durability: "immediate",
        checkpointReason: "Complete Document Imported",
        conflictLabel: "Entire document",
      };
    case "set-enabled-kinds":
    case "set-enabled-outputs":
    case "set-output-options":
      return { targets: ["settings"], durability: "immediate", conflictLabel: "Document settings" };
  }
}

export const problemDefinition = defineDocument<
  ProblemDefinitionDocumentV1,
  ProblemDefinitionCommand,
  ProblemDefinitionSummary
>({
  type: documentType,
  currentSchemaVersion: 1,
  stateSchema: problemDefinitionDocumentSchema,
  commandSchema: problemDefinitionCommandSchema,
  migrations: [],
  reduce: reduceProblemDefinition,
  summarize(state) {
    return {
      title: state.metadata.title,
      status: state.metadata.status,
      entityCount: Object.keys(state.entities).length,
      unresolvedCount: Object.values(state.entities).filter(
        (entity) =>
          entity.status === "blocked" ||
          entity.kind === "unknown" ||
          entity.kind === "open-question",
      ).length,
    };
  },
  commandPolicy: {
    inspect: inspectCommand,
    coalesce(previous, next) {
      if (previous.type === "patch-metadata" && next.type === "patch-metadata")
        return { ...next, patch: { ...previous.patch, ...next.patch } };
      if (
        previous.type === "set-narrative" &&
        next.type === "set-narrative" &&
        previous.section === next.section
      )
        return next;
      if (
        previous.type === "update-entity" &&
        next.type === "update-entity" &&
        previous.entityId === next.entityId
      )
        return { ...next, patch: { ...previous.patch, ...next.patch } };
      if (
        previous.type === "update-note" &&
        next.type === "update-note" &&
        previous.noteId === next.noteId
      )
        return { ...next, patch: { ...previous.patch, ...next.patch } };
      return null;
    },
  },
});
