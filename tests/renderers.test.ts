import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../src/domain/sample";
import { renderOutput } from "../src/domain/renderers";

describe("deterministic projections", () => {
  const document = createSampleDocument();

  it("renders identical working prompts for identical state", () => {
    const first = renderOutput(document, "working-prompt");
    expect(renderOutput(structuredClone(document), "working-prompt")).toBe(first);
    expect(first).toContain("# Neighborhood Tool Library Launch");
    expect(first).toContain("## Decision Required");
    expect(first).toContain("high confidence");
  });

  it("renders discovery, brief, alternative, requirement, markdown, and JSON outputs", () => {
    expect(renderOutput(document, "questionnaire")).toContain("Open Questions");
    expect(renderOutput(document, "questionnaire")).toContain("Insurance requirements");
    expect(renderOutput(document, "problem-brief")).toContain("## Desired Outcome");
    expect(renderOutput(document, "alternatives")).toContain("Evaluation Matrix");
    expect(renderOutput(document, "requirements")).toContain("Track every checkout");
    expect(renderOutput(document, "markdown")).toContain("## Problem Statement");
    expect(JSON.parse(renderOutput(document, "json"))).toEqual(document);
  });

  it("renders valid deterministic Mermaid sources", () => {
    for (const output of [
      "context-diagram",
      "flow-diagram",
      "state-diagram",
      "causal-diagram",
      "traceability-diagram",
    ] as const) {
      expect(renderOutput(document, output)).toMatch(/^flowchart LR/);
    }
    expect(renderOutput(document, "traceability-diagram")).toContain("supports");
  });
});
