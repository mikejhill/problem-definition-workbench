import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../src/domain/sample";
import { translateSuggestions, type AiSuggestion } from "../src/services/firebase-services";

describe("AI proposal validation", () => {
  it("turns grounded suggestions into semantic commands only", () => {
    const document = createSampleDocument();
    const ids = Object.keys(document.entities);
    const suggestions: AiSuggestion[] = [
      {
        action: "suggest-relation",
        sourceId: ids[0],
        targetId: ids[1],
        relationType: "supports",
        rationale: "The source supports the target.",
      },
      {
        action: "suggest-relation",
        sourceId: "unknown-id",
        targetId: ids[1],
        relationType: "supports",
        rationale: "This ID was invented.",
      },
      {
        action: "flag-gap",
        title: "Confirm long-term operating owner",
        rationale: "Ownership remains unspecified.",
      },
    ];

    const commands = translateSuggestions(document, suggestions);

    expect(commands).toHaveLength(2);
    expect(commands.map((command) => command.type)).toEqual(["add-relation", "add-entity"]);
  });

  it("does not turn duplicate flags into executable changes", () => {
    const commands = translateSuggestions(createSampleDocument(), [
      {
        action: "flag-duplicate",
        sourceId: "one",
        targetId: "two",
        rationale: "Review this possible duplicate manually.",
      },
    ]);

    expect(commands).toEqual([]);
  });
});
