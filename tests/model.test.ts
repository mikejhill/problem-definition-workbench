import { describe, expect, it } from "vitest";
import { createId } from "../src/domain/commands";
import { createEmptyDocument, problemDefinitionDocumentSchema } from "../src/domain/model";
import { createSampleDocument } from "../src/domain/sample";

describe("problem definition schema", () => {
  it("creates a complete normalized empty model", () => {
    const document = createEmptyDocument("Test Definition");
    expect(problemDefinitionDocumentSchema.parse(document)).toEqual(document);
    expect(Object.keys(document.entityOrder)).toHaveLength(29);
  });

  it("rejects entities missing from their typed order", () => {
    const document = createEmptyDocument();
    const id = createId();
    document.entities[id] = {
      id,
      kind: "risk",
      title: "Unordered",
      description: "",
      classification: "observation",
      confidence: "low",
      status: "active",
      priority: "low",
      source: "",
      rationale: "",
      verificationMethod: "",
      evidenceIds: [],
      stakeholderIds: [],
      attributes: {},
    };
    expect(problemDefinitionDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("rejects invalid evidence and relation references", () => {
    const document = createSampleDocument();
    const observation = document.entities[document.entityOrder.observation[0]!]!;
    observation.evidenceIds = [createId()];
    expect(problemDefinitionDocumentSchema.safeParse(document).success).toBe(false);
  });

  it("builds a valid curated sample", () => {
    const sample = createSampleDocument();
    expect(sample.metadata.title).toBe("Neighborhood Tool Library Launch");
    expect(sample.relationOrder).toHaveLength(4);
  });
});
