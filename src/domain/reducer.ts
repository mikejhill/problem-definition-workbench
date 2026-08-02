import type { ReducerResult } from "@mikejhill/portable-document-core";
import {
  problemDefinitionDocumentSchema,
  type AttachmentReference,
  type InboxNote,
  type ModelEntity,
  type ProblemDefinitionDocumentV1,
} from "./model";
import {
  problemDefinitionCommandSchema,
  type PrimitiveProblemDefinitionCommand,
  type ProblemDefinitionCommand,
} from "./commands";

function reject(
  message: string,
  recoverable?: unknown,
): ReducerResult<ProblemDefinitionDocumentV1> {
  return { ok: false, code: "missing-target", message, recoverable };
}

function insert<T>(values: readonly T[], value: T, requestedIndex?: number): T[] {
  const next = [...values];
  const index = requestedIndex === undefined ? next.length : Math.min(requestedIndex, next.length);
  next.splice(index, 0, value);
  return next;
}

function move<T>(values: readonly T[], currentIndex: number, requestedIndex: number): T[] {
  const next = [...values];
  const [value] = next.splice(currentIndex, 1);
  if (value === undefined) return next;
  next.splice(Math.min(requestedIndex, next.length), 0, value);
  return next;
}

function definedPatch<T extends object>(patch: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function reducePrimitive(
  state: ProblemDefinitionDocumentV1,
  command: PrimitiveProblemDefinitionCommand,
): ReducerResult<ProblemDefinitionDocumentV1> {
  switch (command.type) {
    case "patch-metadata":
      return {
        ok: true,
        state: {
          ...state,
          metadata: {
            ...state.metadata,
            ...definedPatch(command.patch),
          } as ProblemDefinitionDocumentV1["metadata"],
        },
      };
    case "set-narrative":
      return {
        ok: true,
        state: { ...state, narratives: { ...state.narratives, [command.section]: command.value } },
      };
    case "add-entity": {
      if (state.entities[command.entity.id]) return reject("Entity ID already exists.", command);
      const kind = command.entity.kind;
      return {
        ok: true,
        state: {
          ...state,
          entities: { ...state.entities, [command.entity.id]: command.entity },
          entityOrder: {
            ...state.entityOrder,
            [kind]: insert(state.entityOrder[kind], command.entity.id, command.index),
          },
        },
      };
    }
    case "update-entity": {
      const current = state.entities[command.entityId];
      if (!current) return reject("The target entity no longer exists.", command);
      return {
        ok: true,
        state: {
          ...state,
          entities: {
            ...state.entities,
            [current.id]: { ...current, ...definedPatch(command.patch) } as ModelEntity,
          },
        },
      };
    }
    case "delete-entity": {
      const current = state.entities[command.entityId];
      if (!current) return reject("The target entity no longer exists.", command);
      const entities = { ...state.entities };
      delete entities[current.id];
      for (const [id, entity] of Object.entries(entities)) {
        entities[id] = {
          ...entity,
          evidenceIds: entity.evidenceIds.filter((value) => value !== current.id),
          stakeholderIds: entity.stakeholderIds.filter((value) => value !== current.id),
        };
      }
      const removedRelations = new Set(
        Object.values(state.relations)
          .filter(
            (relation) => relation.sourceId === current.id || relation.targetId === current.id,
          )
          .map((relation) => relation.id),
      );
      return {
        ok: true,
        state: {
          ...state,
          entities,
          entityOrder: {
            ...state.entityOrder,
            [current.kind]: state.entityOrder[current.kind].filter((id) => id !== current.id),
          },
          relations: Object.fromEntries(
            Object.entries(state.relations).filter(([id]) => !removedRelations.has(id)),
          ),
          relationOrder: state.relationOrder.filter((id) => !removedRelations.has(id)),
        },
      };
    }
    case "move-entity": {
      const current = state.entities[command.entityId];
      if (!current) return reject("The target entity no longer exists.", command);
      const order = state.entityOrder[current.kind];
      return {
        ok: true,
        state: {
          ...state,
          entityOrder: {
            ...state.entityOrder,
            [current.kind]: move(order, order.indexOf(current.id), command.index),
          },
        },
      };
    }
    case "add-relation":
      if (state.relations[command.relation.id])
        return reject("Relation ID already exists.", command);
      if (
        !state.entities[command.relation.sourceId] ||
        !state.entities[command.relation.targetId]
      ) {
        return reject("A relation endpoint does not exist.", command);
      }
      if (command.relation.sourceId === command.relation.targetId)
        return reject("A relation cannot target itself.", command);
      return {
        ok: true,
        state: {
          ...state,
          relations: { ...state.relations, [command.relation.id]: command.relation },
          relationOrder: insert(state.relationOrder, command.relation.id, command.index),
        },
      };
    case "delete-relation": {
      if (!state.relations[command.relationId])
        return reject("The target relation no longer exists.", command);
      const relations = { ...state.relations };
      delete relations[command.relationId];
      return {
        ok: true,
        state: {
          ...state,
          relations,
          relationOrder: state.relationOrder.filter((id) => id !== command.relationId),
        },
      };
    }
    case "add-note":
      if (state.inbox.some((note) => note.id === command.note.id))
        return reject("Note ID already exists.", command);
      return { ok: true, state: { ...state, inbox: [...state.inbox, command.note] } };
    case "update-note": {
      const index = state.inbox.findIndex((note) => note.id === command.noteId);
      if (index < 0) return reject("The target note no longer exists.", command);
      return {
        ok: true,
        state: {
          ...state,
          inbox: state.inbox.map((note, currentIndex) =>
            currentIndex === index
              ? ({ ...note, ...definedPatch(command.patch) } as InboxNote)
              : note,
          ),
        },
      };
    }
    case "delete-note":
      if (!state.inbox.some((note) => note.id === command.noteId))
        return reject("The target note no longer exists.", command);
      return {
        ok: true,
        state: { ...state, inbox: state.inbox.filter((note) => note.id !== command.noteId) },
      };
    case "move-note": {
      const index = state.inbox.findIndex((note) => note.id === command.noteId);
      if (index < 0) return reject("The target note no longer exists.", command);
      return { ok: true, state: { ...state, inbox: move(state.inbox, index, command.index) } };
    }
    case "add-attachment":
      if (state.attachments[command.attachment.id])
        return reject("Attachment ID already exists.", command);
      return {
        ok: true,
        state: {
          ...state,
          attachments: { ...state.attachments, [command.attachment.id]: command.attachment },
          attachmentOrder: insert(state.attachmentOrder, command.attachment.id, command.index),
        },
      };
    case "update-attachment": {
      const attachment = state.attachments[command.attachmentId];
      if (!attachment) return reject("The source link no longer exists.", command);
      return {
        ok: true,
        state: {
          ...state,
          attachments: {
            ...state.attachments,
            [attachment.id]: {
              ...attachment,
              ...definedPatch(command.patch),
            } as AttachmentReference,
          },
        },
      };
    }
    case "delete-attachment": {
      if (!state.attachments[command.attachmentId])
        return reject("The source link no longer exists.", command);
      const attachments = { ...state.attachments };
      delete attachments[command.attachmentId];
      return {
        ok: true,
        state: {
          ...state,
          attachments,
          attachmentOrder: state.attachmentOrder.filter((id) => id !== command.attachmentId),
        },
      };
    }
    case "move-attachment": {
      const index = state.attachmentOrder.indexOf(command.attachmentId);
      if (index < 0) return reject("The source link no longer exists.", command);
      return {
        ok: true,
        state: { ...state, attachmentOrder: move(state.attachmentOrder, index, command.index) },
      };
    }
    case "convert-note": {
      const note = state.inbox.find((item) => item.id === command.noteId);
      if (!note) return reject("The target note no longer exists.", command);
      if (state.entities[command.entity.id]) return reject("Entity ID already exists.", command);
      const added = reducePrimitive(state, {
        type: "add-entity",
        entity: command.entity,
        ...(command.index === undefined ? {} : { index: command.index }),
      });
      if (!added.ok) return added;
      return {
        ok: true,
        state: {
          ...added.state,
          inbox: added.state.inbox.filter((item) => item.id !== command.noteId),
        },
      };
    }
    case "set-enabled-kinds":
      return {
        ok: true,
        state: {
          ...state,
          settings: { ...state.settings, enabledKinds: [...new Set(command.kinds)] },
        },
      };
    case "set-enabled-outputs":
      return {
        ok: true,
        state: {
          ...state,
          settings: { ...state.settings, enabledOutputs: [...new Set(command.outputs)] },
        },
      };
    case "set-output-options":
      return {
        ok: true,
        state: {
          ...state,
          settings: {
            ...state.settings,
            ...(command.includeConfidence === undefined
              ? {}
              : { includeConfidence: command.includeConfidence }),
            ...(command.includeEmptySections === undefined
              ? {}
              : { includeEmptySections: command.includeEmptySections }),
          },
        },
      };
  }
}

export function reduceProblemDefinition(
  state: ProblemDefinitionDocumentV1,
  input: ProblemDefinitionCommand,
): ReducerResult<ProblemDefinitionDocumentV1> {
  const command = problemDefinitionCommandSchema.parse(input);
  if (command.type === "replace-document") return { ok: true, state: command.document };
  if (command.type === "apply-batch") {
    let next = state;
    for (const child of command.commands) {
      const result = reducePrimitive(next, child);
      if (!result.ok) return result;
      next = result.state;
    }
    return { ok: true, state: next };
  }
  const result = reducePrimitive(state, command);
  if (!result.ok) return result;
  const parsed = problemDefinitionDocumentSchema.safeParse(result.state);
  return parsed.success
    ? { ok: true, state: parsed.data }
    : {
        ok: false,
        code: "failed-precondition",
        message: parsed.error.issues[0]?.message ?? "The command produced invalid state.",
        recoverable: command,
      };
}
