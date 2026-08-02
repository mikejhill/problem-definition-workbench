import { describe, expect, it } from "vitest";
import { applyDocumentCommand } from "@mikejhill/portable-document-core";
import { createId, type ProblemDefinitionCommand } from "../src/domain/commands";
import { problemDefinition } from "../src/domain/definition";
import { createEmptyDocument, type ModelEntity } from "../src/domain/model";
import { reduceProblemDefinition } from "../src/domain/reducer";

function entity(kind: ModelEntity["kind"], title: string): ModelEntity {
  return {
    id: createId(),
    kind,
    title,
    description: "",
    classification: "observation",
    confidence: "unknown",
    status: "active",
    priority: "unspecified",
    source: "",
    rationale: "",
    verificationMethod: "",
    evidenceIds: [],
    stakeholderIds: [],
    attributes: {},
  };
}

function apply(command: ProblemDefinitionCommand) {
  const result = reduceProblemDefinition(createEmptyDocument(), command);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

describe("semantic reducer", () => {
  it("patches metadata and narratives without mutating the source", () => {
    const source = createEmptyDocument();
    const result = reduceProblemDefinition(source, {
      type: "patch-metadata",
      patch: { title: "Changed" },
    });
    expect(result.ok && result.state.metadata.title).toBe("Changed");
    expect(source.metadata.title).toBe("Untitled Problem Definition");
    const narrative = reduceProblemDefinition(source, {
      type: "set-narrative",
      section: "problemStatement",
      value: "A measurable gap.",
    });
    expect(narrative.ok && narrative.state.narratives.problemStatement).toBe("A measurable gap.");
  });

  it("adds, updates, moves, and deletes entities", () => {
    const first = entity("risk", "First");
    const second = entity("risk", "Second");
    let state = apply({ type: "add-entity", entity: first });
    let result = reduceProblemDefinition(state, { type: "add-entity", entity: second });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;
    result = reduceProblemDefinition(state, { type: "move-entity", entityId: second.id, index: 0 });
    expect(result.ok && result.state.entityOrder.risk[0]).toBe(second.id);
    if (!result.ok) return;
    result = reduceProblemDefinition(result.state, {
      type: "update-entity",
      entityId: first.id,
      patch: { confidence: "high" },
    });
    expect(result.ok && result.state.entities[first.id]?.confidence).toBe("high");
    if (!result.ok) return;
    result = reduceProblemDefinition(result.state, { type: "delete-entity", entityId: first.id });
    expect(result.ok && result.state.entities[first.id]).toBeUndefined();
  });

  it("removes dependent references and relationships when deleting an entity", () => {
    const evidence = entity("evidence", "Evidence");
    const requirement = { ...entity("requirement", "Requirement"), evidenceIds: [evidence.id] };
    let state = createEmptyDocument();
    for (const item of [evidence, requirement]) {
      const result = reduceProblemDefinition(state, { type: "add-entity", entity: item });
      if (!result.ok) throw new Error(result.message);
      state = result.state;
    }
    const relationId = createId();
    const linked = reduceProblemDefinition(state, {
      type: "add-relation",
      relation: {
        id: relationId,
        type: "supports",
        sourceId: evidence.id,
        targetId: requirement.id,
        description: "",
        confidence: "high",
      },
    });
    if (!linked.ok) throw new Error(linked.message);
    const deleted = reduceProblemDefinition(linked.state, {
      type: "delete-entity",
      entityId: evidence.id,
    });
    expect(deleted.ok && deleted.state.entities[requirement.id]?.evidenceIds).toEqual([]);
    expect(deleted.ok && deleted.state.relations[relationId]).toBeUndefined();
  });

  it("converts inbox notes and applies validated batches atomically", () => {
    const noteId = createId();
    let state = apply({
      type: "add-note",
      note: { id: noteId, text: "Budget is unknown", createdAt: 1 },
    });
    const unknown = entity("unknown", "Budget");
    let result = reduceProblemDefinition(state, { type: "convert-note", noteId, entity: unknown });
    expect(result.ok && result.state.inbox).toEqual([]);
    expect(result.ok && result.state.entities[unknown.id]).toBeDefined();
    state = result.ok ? result.state : state;
    result = reduceProblemDefinition(state, {
      type: "apply-batch",
      label: "Reviewed proposal",
      commands: [
        { type: "set-narrative", section: "targetState", value: "Target" },
        { type: "delete-entity", entityId: createId() },
      ],
    });
    expect(result.ok).toBe(false);
    expect(state.narratives.targetState).toBe("");
  });

  it("maintains source link metadata and output settings", () => {
    const attachmentId = createId();
    const state = apply({
      type: "add-attachment",
      attachment: {
        id: attachmentId,
        label: "Inspection report",
        mediaType: "application/pdf",
        description: "",
      },
    });
    let result = reduceProblemDefinition(state, {
      type: "update-attachment",
      attachmentId,
      patch: { description: "External record" },
    });
    expect(result.ok && result.state.attachments[attachmentId]?.description).toBe(
      "External record",
    );
    if (!result.ok) return;
    result = reduceProblemDefinition(result.state, {
      type: "set-output-options",
      includeConfidence: false,
    });
    expect(result.ok && result.state.settings.includeConfidence).toBe(false);
    if (!result.ok) return;
    result = reduceProblemDefinition(result.state, { type: "delete-attachment", attachmentId });
    expect(result.ok && result.state.attachmentOrder).toEqual([]);
  });

  it("validates commands through the shared document definition", () => {
    const result = applyDocumentCommand(problemDefinition, createEmptyDocument(), {
      type: "delete-entity",
      entityId: "not-a-uuid",
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe("invalid-command");
  });
});
