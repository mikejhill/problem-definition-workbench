import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { sectionCatalog, relationLabels, type SectionDefinition } from "../domain/catalog";
import { createId, type ProblemDefinitionCommand } from "../domain/commands";
import {
  classificationSchema,
  confidenceSchema,
  entityKindSchema,
  entityStatusSchema,
  prioritySchema,
  relationTypeSchema,
  type EntityKind,
  type ModelEntity,
  type NarrativeSection,
  type ProblemDefinitionDocumentV1,
} from "../domain/model";
import { SelectField, TextField } from "./Field";

type SectionEditorProps = {
  readonly document: ProblemDefinitionDocumentV1;
  readonly sectionId: SectionDefinition["id"];
  readonly dispatch: (command: ProblemDefinitionCommand) => void;
};

export function SectionEditor({ document, sectionId, dispatch }: SectionEditorProps) {
  const section = sectionCatalog.find((item) => item.id === sectionId) ?? sectionCatalog[0]!;
  return (
    <main className="editor-pane">
      <header className="section-header">
        <span className="eyebrow">{section.group}</span>
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </header>
      {section.mode === "narrative" ? (
        <TextField
          label={section.label}
          value={document.narratives[section.id as NarrativeSection]}
          onCommit={(value) =>
            dispatch({ type: "set-narrative", section: section.id as NarrativeSection, value })
          }
          multiline
          placeholder="Write a clear, specific statement. Separate verified conditions from interpretations."
        />
      ) : null}
      {section.mode === "metadata" ? (
        <MetadataEditor document={document} dispatch={dispatch} />
      ) : null}
      {section.mode === "entities" ? (
        <EntitySection document={document} kind={section.id as EntityKind} dispatch={dispatch} />
      ) : null}
      {section.mode === "inbox" ? <InboxEditor document={document} dispatch={dispatch} /> : null}
      {section.mode === "relations" ? (
        <RelationshipEditor document={document} dispatch={dispatch} />
      ) : null}
      {section.mode === "attachments" ? (
        <AttachmentEditor document={document} dispatch={dispatch} />
      ) : null}
    </main>
  );
}

function MetadataEditor({
  document,
  dispatch,
}: {
  document: ProblemDefinitionDocumentV1;
  dispatch: (command: ProblemDefinitionCommand) => void;
}) {
  return (
    <div>
      <TextField
        label="Project Title"
        value={document.metadata.title}
        onCommit={(title) => dispatch({ type: "patch-metadata", patch: { title } })}
        required
      />
      <div className="field-grid">
        <TextField
          label="Project Type"
          value={document.metadata.projectType}
          onCommit={(projectType) => dispatch({ type: "patch-metadata", patch: { projectType } })}
          placeholder="Physical project, software, policy, operations…"
        />
        <TextField
          label="Owner"
          value={document.metadata.owner}
          onCommit={(owner) => dispatch({ type: "patch-metadata", patch: { owner } })}
        />
        <SelectField
          label="Status"
          value={document.metadata.status}
          options={["discovering", "defining", "evaluating", "deciding", "complete"].map(
            (value) => ({
              value: value as ProblemDefinitionDocumentV1["metadata"]["status"],
              label: sentence(value),
            }),
          )}
          onChange={(status) => dispatch({ type: "patch-metadata", patch: { status } })}
        />
        <TextField
          label="Target Decision Date"
          value={document.metadata.targetDecisionDate}
          onCommit={(targetDecisionDate) =>
            dispatch({ type: "patch-metadata", patch: { targetDecisionDate } })
          }
          placeholder="YYYY-MM-DD or a plain-language milestone"
        />
      </div>
    </div>
  );
}

function createEntity(kind: EntityKind, title: string): ModelEntity {
  return {
    id: createId(),
    kind,
    title,
    description: "",
    classification:
      kind === "assumption" ? "assumption" : kind === "hypothesis" ? "hypothesis" : "observation",
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

function EntitySection({
  document,
  kind,
  dispatch,
}: {
  document: ProblemDefinitionDocumentV1;
  kind: EntityKind;
  dispatch: (command: ProblemDefinitionCommand) => void;
}) {
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const ids = document.entityOrder[kind];
  const add = () => {
    if (!title.trim()) return;
    const entity = createEntity(kind, title.trim());
    dispatch({ type: "add-entity", entity });
    setTitle("");
    setExpanded(entity.id);
  };
  return (
    <div className="entity-section">
      <div className="quick-add">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          placeholder={`Add ${kind.replaceAll("-", " ")}`}
          aria-label={`New ${kind.replaceAll("-", " ")} title`}
        />
        <button className="primary compact" onClick={add}>
          <Plus size={16} /> Add
        </button>
      </div>
      {ids.length === 0 ? <EmptyState label={kind.replaceAll("-", " ")} /> : null}
      <div className="entity-list">
        {ids.map((id, index) => {
          const entity = document.entities[id];
          if (!entity) return null;
          return (
            <article className={expanded === id ? "entity-card expanded" : "entity-card"} key={id}>
              <button
                className="entity-card-summary"
                onClick={() => setExpanded(expanded === id ? null : id)}
                aria-expanded={expanded === id}
              >
                <span>
                  <strong>{entity.title}</strong>
                  <small>
                    {entity.classification} · {entity.confidence} confidence
                  </small>
                </span>
                <span className={`status-pill ${entity.status}`}>{entity.status}</span>
              </button>
              <div className="row-actions">
                <button
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => dispatch({ type: "move-entity", entityId: id, index: index - 1 })}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  aria-label="Move down"
                  disabled={index === ids.length - 1}
                  onClick={() => dispatch({ type: "move-entity", entityId: id, index: index + 1 })}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  className="danger-icon"
                  aria-label="Delete"
                  onClick={() => {
                    if (window.confirm(`Delete “${entity.title}” and its relationships?`))
                      dispatch({ type: "delete-entity", entityId: id });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {expanded === id ? (
                <EntityForm entity={entity} document={document} dispatch={dispatch} />
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EntityForm({
  entity,
  document,
  dispatch,
}: {
  entity: ModelEntity;
  document: ProblemDefinitionDocumentV1;
  dispatch: (command: ProblemDefinitionCommand) => void;
}) {
  const patch = (value: Partial<Omit<ModelEntity, "id" | "kind">>) =>
    dispatch({ type: "update-entity", entityId: entity.id, patch: value });
  const evidence = document.entityOrder.evidence.flatMap((id) =>
    document.entities[id] ? [document.entities[id]] : [],
  );
  const stakeholders = document.entityOrder.stakeholder.flatMap((id) =>
    document.entities[id] ? [document.entities[id]] : [],
  );
  return (
    <div className="entity-form">
      <TextField
        label="Title"
        value={entity.title}
        onCommit={(title) => patch({ title })}
        required
      />
      <TextField
        label="Description"
        value={entity.description}
        onCommit={(description) => patch({ description })}
        multiline
      />
      <div className="field-grid">
        <SelectField
          label="Classification"
          value={entity.classification}
          options={classificationSchema.options.map((value) => ({ value, label: sentence(value) }))}
          onChange={(classification) => patch({ classification })}
        />
        <SelectField
          label="Confidence"
          value={entity.confidence}
          options={confidenceSchema.options.map((value) => ({ value, label: sentence(value) }))}
          onChange={(confidence) => patch({ confidence })}
        />
        <SelectField
          label="Status"
          value={entity.status}
          options={entityStatusSchema.options.map((value) => ({ value, label: sentence(value) }))}
          onChange={(status) => patch({ status })}
        />
        <SelectField
          label="Priority"
          value={entity.priority}
          options={prioritySchema.options.map((value) => ({ value, label: sentence(value) }))}
          onChange={(priority) => patch({ priority })}
        />
      </div>
      <TextField
        label="Source"
        value={entity.source}
        onCommit={(source) => patch({ source })}
        placeholder="Observation, measurement, record, person, or URL"
      />
      <TextField
        label="Rationale / Consequence If False"
        value={entity.rationale}
        onCommit={(rationale) => patch({ rationale })}
        multiline
      />
      <TextField
        label="Verification Method"
        value={entity.verificationMethod}
        onCommit={(verificationMethod) => patch({ verificationMethod })}
        multiline
      />
      {entity.kind !== "evidence" && evidence.length ? (
        <ReferenceSelector
          label="Evidence"
          values={evidence}
          selected={entity.evidenceIds}
          onChange={(evidenceIds) => patch({ evidenceIds })}
        />
      ) : null}
      {entity.kind !== "stakeholder" && stakeholders.length ? (
        <ReferenceSelector
          label="Affected Stakeholders"
          values={stakeholders}
          selected={entity.stakeholderIds}
          onChange={(stakeholderIds) => patch({ stakeholderIds })}
        />
      ) : null}
    </div>
  );
}

function ReferenceSelector({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: readonly ModelEntity[];
  selected: readonly string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="reference-selector">
      <legend>{label}</legend>
      {values.map((item) => (
        <label key={item.id}>
          <input
            type="checkbox"
            checked={selected.includes(item.id)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, item.id]
                  : selected.filter((id) => id !== item.id),
              )
            }
          />
          {item.title}
        </label>
      ))}
    </fieldset>
  );
}

function InboxEditor({
  document,
  dispatch,
}: {
  document: ProblemDefinitionDocumentV1;
  dispatch: (command: ProblemDefinitionCommand) => void;
}) {
  const [text, setText] = useState("");
  const [kinds, setKinds] = useState<Record<string, EntityKind>>({});
  const add = () => {
    if (!text.trim()) return;
    dispatch({
      type: "add-note",
      note: { id: createId(), text: text.trim(), createdAt: Date.now() },
    });
    setText("");
  };
  return (
    <div className="entity-section">
      <div className="quick-add note-add">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Capture an observation, question, requirement, risk, or idea without stopping to classify it."
          rows={4}
        />
        <button className="primary compact" onClick={add}>
          <Plus size={16} /> Capture
        </button>
      </div>
      {document.inbox.length === 0 ? <EmptyState label="inbox note" /> : null}
      {document.inbox.map((note) => {
        const kind = kinds[note.id] ?? "observation";
        return (
          <article className="inbox-card" key={note.id}>
            <TextField
              label="Captured Note"
              value={note.text}
              onCommit={(value) =>
                dispatch({ type: "update-note", noteId: note.id, patch: { text: value } })
              }
              multiline
            />
            <div className="convert-row">
              <select
                aria-label="Convert note to"
                value={kind}
                onChange={(event) =>
                  setKinds({ ...kinds, [note.id]: event.target.value as EntityKind })
                }
              >
                {entityKindSchema.options.map((value) => (
                  <option value={value} key={value}>
                    {sentence(value)}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  dispatch({
                    type: "convert-note",
                    noteId: note.id,
                    entity: createEntity(kind, note.text.slice(0, 120)),
                  })
                }
              >
                Convert
              </button>
              <button
                className="danger-icon"
                aria-label="Delete note"
                onClick={() => dispatch({ type: "delete-note", noteId: note.id })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RelationshipEditor({
  document,
  dispatch,
}: {
  document: ProblemDefinitionDocumentV1;
  dispatch: (command: ProblemDefinitionCommand) => void;
}) {
  const entities = Object.values(document.entities);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<(typeof relationTypeSchema.options)[number]>("supports");
  const add = () => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    dispatch({
      type: "add-relation",
      relation: {
        id: createId(),
        sourceId,
        targetId,
        type,
        description: "",
        confidence: "unknown",
      },
    });
    setTargetId("");
  };
  return (
    <div className="relation-editor">
      <div className="relation-builder">
        <select
          aria-label="Relationship source"
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
        >
          <option value="">Select source</option>
          {entities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Relationship type"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
        >
          {relationTypeSchema.options.map((value) => (
            <option value={value} key={value}>
              {relationLabels[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Relationship target"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">Select target</option>
          {entities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <button className="primary compact" onClick={add}>
          <Plus size={16} /> Link
        </button>
      </div>
      {document.relationOrder.length === 0 ? <EmptyState label="relationship" /> : null}
      <div className="relationship-list">
        {document.relationOrder.map((id) => {
          const relation = document.relations[id];
          if (!relation) return null;
          return (
            <div className="relationship-row" key={id}>
              <strong>{document.entities[relation.sourceId]?.title}</strong>
              <span>{relationLabels[relation.type]}</span>
              <strong>{document.entities[relation.targetId]?.title}</strong>
              <button
                className="danger-icon"
                aria-label="Delete relationship"
                onClick={() => dispatch({ type: "delete-relation", relationId: id })}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttachmentEditor({
  document,
  dispatch,
}: {
  document: ProblemDefinitionDocumentV1;
  dispatch: (command: ProblemDefinitionCommand) => void;
}) {
  const [label, setLabel] = useState("");
  const add = () => {
    if (!label.trim()) return;
    dispatch({
      type: "add-attachment",
      attachment: { id: createId(), label: label.trim(), mediaType: "text/plain", description: "" },
    });
    setLabel("");
  };
  return (
    <div className="entity-section">
      <p className="muted">
        Store labels, external URLs, media types, and descriptions only. Binary files are never
        persisted.
      </p>
      <div className="quick-add">
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          placeholder="Add source link label"
        />
        <button className="primary compact" onClick={add}>
          <Plus size={16} /> Add
        </button>
      </div>
      {document.attachmentOrder.length === 0 ? (
        <EmptyState label="source link" />
      ) : (
        document.attachmentOrder.map((id) => {
          const attachment = document.attachments[id];
          if (!attachment) return null;
          return (
            <article className="inbox-card" key={id}>
              <TextField
                label="Label"
                value={attachment.label}
                onCommit={(value) =>
                  dispatch({ type: "update-attachment", attachmentId: id, patch: { label: value } })
                }
                required
              />
              <TextField
                label="External URL"
                value={attachment.url ?? ""}
                onCommit={(value) =>
                  dispatch({
                    type: "update-attachment",
                    attachmentId: id,
                    patch: value ? { url: value } : {},
                  })
                }
                placeholder="https://…"
              />
              <TextField
                label="Media Type"
                value={attachment.mediaType}
                onCommit={(mediaType) =>
                  dispatch({ type: "update-attachment", attachmentId: id, patch: { mediaType } })
                }
                placeholder="text/plain"
              />
              <TextField
                label="Description"
                value={attachment.description}
                onCommit={(description) =>
                  dispatch({ type: "update-attachment", attachmentId: id, patch: { description } })
                }
                multiline
              />
              <button
                className="danger-icon"
                onClick={() => dispatch({ type: "delete-attachment", attachmentId: id })}
              >
                <Trash2 size={15} /> Delete Source Link
              </button>
            </article>
          );
        })
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="empty-state">
      <span>No {label}s yet.</span>
      <small>Add only what improves the definition.</small>
    </div>
  );
}

function sentence(value: string): string {
  return value.replaceAll("-", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
