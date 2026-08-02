import { describe, expect, it } from "vitest";
import { createId } from "../src/domain/commands";
import { problemDefinition } from "../src/domain/definition";
import { createSampleDocument } from "../src/domain/sample";

describe("command policy", () => {
  it("coalesces typing only for an exact entity and field target", () => {
    const entityId = createId();
    const first = { type: "update-entity" as const, entityId, patch: { title: "A" } };
    const next = { type: "update-entity" as const, entityId, patch: { title: "AB" } };
    const otherField = {
      type: "update-entity" as const,
      entityId,
      patch: { description: "Separate target" },
    };

    expect(problemDefinition.commandPolicy.inspect(first)).toMatchObject({
      targets: [`entity:${entityId}:title`],
      coalescingKey: `entity:${entityId}:title`,
      durability: "coalesced",
    });
    expect(problemDefinition.commandPolicy.inspect(otherField).coalescingKey).not.toBe(
      problemDefinition.commandPolicy.inspect(first).coalescingKey,
    );
    expect(problemDefinition.commandPolicy.coalesce?.(first, next)).toEqual(next);
  });

  it("checkpoints structural edits, imports, relation changes, and reviewed batches", () => {
    const entityId = createId();
    const structural = problemDefinition.commandPolicy.inspect({
      type: "delete-entity",
      entityId,
    });
    const relation = problemDefinition.commandPolicy.inspect({
      type: "delete-relation",
      relationId: createId(),
    });
    const imported = problemDefinition.commandPolicy.inspect({
      type: "replace-document",
      document: {} as never,
    });
    const reviewed = problemDefinition.commandPolicy.inspect({
      type: "apply-batch",
      label: "AI Proposal Accepted",
      commands: [],
    });

    expect(structural).toMatchObject({
      durability: "immediate",
      checkpointReason: "Model Structure Changed",
    });
    expect(relation).toMatchObject({
      durability: "immediate",
      checkpointReason: "Relationships Changed",
    });
    expect(imported.checkpointReason).toBe("Complete Document Imported");
    expect(reviewed.checkpointReason).toBe("AI Proposal Accepted");
  });

  it("summarizes unresolved model state without transient UI data", () => {
    const summary = problemDefinition.summarize(createSampleDocument());
    expect(summary.title).toBe("Neighborhood Tool Library Launch");
    expect(summary.entityCount).toBeGreaterThan(0);
    expect(summary.unresolvedCount).toBeGreaterThan(0);
  });
});
