import { AlertCircle, Inbox, Link2, Paperclip } from "lucide-react";
import { sectionCatalog, type SectionDefinition } from "../domain/catalog";
import type { EntityKind, ProblemDefinitionDocumentV1 } from "../domain/model";

type OutlineProps = {
  readonly document: ProblemDefinitionDocumentV1;
  readonly selected: SectionDefinition["id"];
  readonly onSelect: (id: SectionDefinition["id"]) => void;
};

export function Outline({ document, selected, onSelect }: OutlineProps) {
  const groups = [...new Set(sectionCatalog.map((section) => section.group))];
  return (
    <nav className="outline" aria-label="Problem definition framework">
      <div className="outline-intro">
        <span className="eyebrow">Framework</span>
        <h2>Definition Outline</h2>
      </div>
      {groups.map((group) => (
        <section className="outline-group" key={group}>
          <h3>{group}</h3>
          {sectionCatalog
            .filter((section) => section.group === group)
            .map((section) => {
              const count =
                section.mode === "metadata"
                  ? 1
                  : section.mode === "entities"
                    ? document.entityOrder[section.id as EntityKind].length
                    : section.mode === "inbox"
                      ? document.inbox.length
                      : section.mode === "relations"
                        ? document.relationOrder.length
                        : section.mode === "attachments"
                          ? document.attachmentOrder.length
                          : document.narratives[
                                section.id as keyof ProblemDefinitionDocumentV1["narratives"]
                              ].trim()
                            ? 1
                            : 0;
              const Icon =
                section.mode === "inbox"
                  ? Inbox
                  : section.mode === "relations"
                    ? Link2
                    : section.mode === "attachments"
                      ? Paperclip
                      : count === 0
                        ? AlertCircle
                        : null;
              return (
                <button
                  key={section.id}
                  className={selected === section.id ? "outline-item active" : "outline-item"}
                  onClick={() => onSelect(section.id)}
                  aria-current={selected === section.id ? "page" : undefined}
                >
                  <span>
                    {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                    {section.label}
                  </span>
                  <span className={count ? "count" : "count empty"}>{count}</span>
                </button>
              );
            })}
        </section>
      ))}
    </nav>
  );
}
