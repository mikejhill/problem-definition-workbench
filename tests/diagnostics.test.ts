import { describe, expect, it } from "vitest";
import { analyzeDocument, diagnosticCounts } from "../src/domain/diagnostics";
import { createEmptyDocument } from "../src/domain/model";
import { createSampleDocument } from "../src/domain/sample";

describe("quality diagnostics", () => {
  it("reports missing core structure without inventing a completion score", () => {
    const diagnostics = analyzeDocument(createEmptyDocument());
    expect(diagnostics.map((item) => item.id)).toEqual(
      expect.arrayContaining(["missing:problem", "missing:target", "missing:decision"]),
    );
    expect(diagnosticCounts(diagnostics)["missing-structure"]).toBeGreaterThan(0);
  });

  it("reports blockers, traceability gaps, and contradictions", () => {
    const document = createSampleDocument();
    const requirement = document.entities[document.entityOrder.requirement[0]!]!;
    const objective = document.entities[document.entityOrder.objective[0]!]!;
    const relation = Object.values(document.relations).find(
      (item) => item.sourceId === requirement.id,
    );
    if (relation) delete document.relations[relation.id];
    if (relation)
      document.relationOrder = document.relationOrder.filter((id) => id !== relation.id);
    const id = crypto.randomUUID();
    document.relations[id] = {
      id,
      type: "contradicts",
      sourceId: requirement.id,
      targetId: objective.id,
      description: "",
      confidence: "medium",
    };
    document.relationOrder.push(id);
    const diagnostics = analyzeDocument(document);
    expect(diagnostics.some((item) => item.category === "blocker")).toBe(true);
    expect(diagnostics.some((item) => item.category === "traceability")).toBe(true);
    expect(diagnostics.some((item) => item.category === "contradiction")).toBe(true);
  });
});
