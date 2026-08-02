import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outline } from "../src/components/Outline";
import { SectionEditor } from "../src/components/SectionEditor";
import { createEmptyDocument } from "../src/domain/model";

describe("workbench views", () => {
  it("renders the framework outline with counts and selection", async () => {
    const select = vi.fn();
    render(
      <Outline document={createEmptyDocument()} selected="problemStatement" onSelect={select} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Inbox/ }));
    expect(select).toHaveBeenCalledWith("inbox");
    expect(screen.getByRole("button", { name: /Problem Statement/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("dispatches narrative commits and entity additions", async () => {
    const dispatch = vi.fn();
    const { rerender } = render(
      <SectionEditor
        document={createEmptyDocument()}
        sectionId="problemStatement"
        dispatch={dispatch}
      />,
    );
    const textarea = screen.getByRole("textbox", { name: "Problem Statement" });
    await userEvent.type(textarea, "Defined gap");
    await userEvent.tab();
    expect(dispatch).toHaveBeenCalledWith({
      type: "set-narrative",
      section: "problemStatement",
      value: "Defined gap",
    });
    rerender(
      <SectionEditor document={createEmptyDocument()} sectionId="risk" dispatch={dispatch} />,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "New risk title" }), "Budget overrun");
    await userEvent.click(screen.getByRole("button", { name: /Add/ }));
    expect(dispatch.mock.calls.at(-1)?.[0]).toMatchObject({
      type: "add-entity",
      entity: { kind: "risk", title: "Budget overrun" },
    });
  });
});
