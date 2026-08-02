import { sectionCatalog } from "./catalog";
import { analyzeDocument } from "./diagnostics";
import {
  entityKinds,
  type EntityKind,
  type ModelEntity,
  type OutputTemplate,
  type ProblemDefinitionDocumentV1,
} from "./model";

function heading(value: string, level = 2): string {
  return `${"#".repeat(level)} ${value}`;
}

function entityLine(entity: ModelEntity, includeConfidence: boolean): string {
  const metadata = [
    entity.classification,
    includeConfidence ? `${entity.confidence} confidence` : "",
    entity.priority !== "unspecified" ? `${entity.priority} priority` : "",
  ]
    .filter(Boolean)
    .join("; ");
  const description = entity.description.trim() ? ` — ${entity.description.trim()}` : "";
  return `- **${entity.title}**${description}${metadata ? ` _(${metadata})_` : ""}`;
}

function orderedEntities(
  document: ProblemDefinitionDocumentV1,
  kind: EntityKind,
): readonly ModelEntity[] {
  return document.entityOrder[kind].flatMap((id) =>
    document.entities[id] ? [document.entities[id]] : [],
  );
}

function entitySection(
  document: ProblemDefinitionDocumentV1,
  kind: EntityKind,
  label?: string,
): string {
  const entities = orderedEntities(document, kind);
  if (entities.length === 0 && !document.settings.includeEmptySections) return "";
  const sectionLabel =
    label ?? sectionCatalog.find((section) => section.id === kind)?.label ?? kind;
  return [
    heading(sectionLabel),
    ...entities.map((entity) => entityLine(entity, document.settings.includeConfidence)),
  ].join("\n");
}

function narrativeSection(
  document: ProblemDefinitionDocumentV1,
  key: keyof ProblemDefinitionDocumentV1["narratives"],
  label: string,
): string {
  const value = document.narratives[key].trim();
  if (!value && !document.settings.includeEmptySections) return "";
  return `${heading(label)}\n${value || "_Not yet defined._"}`;
}

function joinSections(sections: readonly string[]): string {
  return sections.filter((section) => section.trim()).join("\n\n");
}

function renderWorkingPrompt(document: ProblemDefinitionDocumentV1): string {
  const diagnostics = analyzeDocument(document).filter((item) => item.severity !== "info");
  return joinSections([
    heading(document.metadata.title, 1),
    "Analyze the structured problem definition below. Resolve the requested decision and produce the specified deliverables. Distinguish verified facts, observations, inferences, assumptions, hypotheses, and recommendations. Do not silently fill critical unknowns.",
    narrativeSection(document, "initialConcern", "Initial Concern"),
    narrativeSection(document, "problemStatement", "Problem Statement"),
    narrativeSection(document, "currentState", "Current State"),
    narrativeSection(document, "history", "History and Change Context"),
    ...(
      [
        "impact",
        "scope-item",
        "stakeholder",
        "component",
        "term",
        "evidence",
        "observation",
        "assumption",
        "hypothesis",
        "unknown",
        "open-question",
        "flow",
        "scenario",
        "state",
        "transition",
        "symptom",
        "cause",
        "contributing-condition",
      ] as const
    )
      .filter((kind) => document.settings.enabledKinds.includes(kind))
      .map((kind) => entitySection(document, kind)),
    narrativeSection(document, "targetState", "Target State"),
    ...(
      [
        "objective",
        "acceptance-criterion",
        "requirement",
        "preference",
        "constraint",
        "priority",
        "risk",
        "alternative",
        "evaluation-criterion",
        "decision",
      ] as const
    )
      .filter((kind) => document.settings.enabledKinds.includes(kind))
      .map((kind) => entitySection(document, kind)),
    narrativeSection(document, "requestedDecision", "Decision Required"),
    narrativeSection(document, "safetyBoundaries", "Safety and Escalation Boundaries"),
    narrativeSection(document, "requestedDeliverables", "Required Deliverables"),
    entitySection(document, "output-requirement"),
    narrativeSection(document, "responseInstructions", "Response Instructions"),
    diagnostics.length
      ? `${heading("Known Definition Gaps")}\n${diagnostics.map((item) => `- ${item.message}`).join("\n")}`
      : "",
  ]);
}

function renderQuestionnaire(document: ProblemDefinitionDocumentV1): string {
  const questions = [
    ...orderedEntities(document, "unknown"),
    ...orderedEntities(document, "open-question"),
  ];
  const assumptions = orderedEntities(document, "assumption").filter(
    (item) => item.status !== "resolved",
  );
  return joinSections([
    heading(`${document.metadata.title}: Discovery Questionnaire`, 1),
    questions.length
      ? `${heading("Open Questions")}\n${questions.map((item, index) => `${index + 1}. ${item.title}${item.description ? ` — ${item.description}` : ""}`).join("\n")}`
      : `${heading("Open Questions")}\n- No open questions recorded.`,
    assumptions.length
      ? `${heading("Assumptions to Validate")}\n${assumptions.map((item, index) => `${index + 1}. Validate **${item.title}**${item.verificationMethod ? ` using ${item.verificationMethod}` : ". Define a validation method."}`).join("\n")}`
      : "",
  ]);
}

function renderProblemBrief(document: ProblemDefinitionDocumentV1): string {
  return joinSections([
    heading(document.metadata.title, 1),
    narrativeSection(document, "problemStatement", "Problem"),
    narrativeSection(document, "targetState", "Desired Outcome"),
    entitySection(document, "impact"),
    entitySection(document, "scope-item"),
    entitySection(document, "stakeholder"),
    entitySection(document, "constraint"),
    entitySection(document, "risk"),
    narrativeSection(document, "requestedDecision", "Decision Required"),
  ]);
}

function renderAlternatives(document: ProblemDefinitionDocumentV1): string {
  const alternatives = orderedEntities(document, "alternative");
  const criteria = orderedEntities(document, "evaluation-criterion");
  const decisions = orderedEntities(document, "decision");
  return joinSections([
    heading(`${document.metadata.title}: Alternative Evaluation`, 1),
    entitySection(document, "alternative"),
    entitySection(document, "evaluation-criterion"),
    heading("Evaluation Matrix"),
    alternatives.length && criteria.length
      ? `| Alternative | ${criteria.map((item) => item.title.replaceAll("|", "\\|")).join(" | ")} |\n| --- | ${criteria.map(() => "---").join(" | ")} |\n${alternatives.map((item) => `| ${item.title.replaceAll("|", "\\|")} | ${criteria.map(() => "Not evaluated").join(" | ")} |`).join("\n")}`
      : "Add at least one alternative and one evaluation criterion.",
    decisions.length ? entitySection(document, "decision") : "",
  ]);
}

function renderRequirements(document: ProblemDefinitionDocumentV1): string {
  const requirements = orderedEntities(document, "requirement");
  return joinSections([
    heading(`${document.metadata.title}: Requirements and Traceability`, 1),
    requirements.length
      ? `| Requirement | Priority | Verification | Related Elements |\n| --- | --- | --- | --- |\n${requirements
          .map((item) => {
            const related = Object.values(document.relations)
              .filter((relation) => relation.sourceId === item.id || relation.targetId === item.id)
              .map(
                (relation) =>
                  document.entities[
                    relation.sourceId === item.id ? relation.targetId : relation.sourceId
                  ]?.title,
              )
              .filter(Boolean)
              .join(", ");
            return `| ${item.title.replaceAll("|", "\\|")} | ${item.priority} | ${(item.verificationMethod || "Unspecified").replaceAll("|", "\\|")} | ${related || "Untraced"} |`;
          })
          .join("\n")}`
      : "No requirements recorded.",
  ]);
}

function safeMermaid(value: string): string {
  return value
    .replace(/["\n\r]/g, " ")
    .replaceAll("[", "")
    .replaceAll("]", "")
    .replaceAll("{", "")
    .replaceAll("}", "")
    .replaceAll("(", "")
    .replaceAll(")", "")
    .slice(0, 70);
}

function nodeId(id: string): string {
  return `n${id.replaceAll("-", "")}`;
}

function diagramForKinds(
  document: ProblemDefinitionDocumentV1,
  kinds: readonly EntityKind[],
  relationTypes?: readonly string[],
): string {
  const entities = Object.values(document.entities).filter((entity) => kinds.includes(entity.kind));
  const entityIds = new Set(entities.map((entity) => entity.id));
  const lines = [
    "flowchart LR",
    ...entities.map((entity) => `  ${nodeId(entity.id)}["${safeMermaid(entity.title)}"]`),
  ];
  for (const relation of Object.values(document.relations)) {
    if (
      entityIds.has(relation.sourceId) &&
      entityIds.has(relation.targetId) &&
      (!relationTypes || relationTypes.includes(relation.type))
    ) {
      lines.push(
        `  ${nodeId(relation.sourceId)} -- "${relation.type}" --> ${nodeId(relation.targetId)}`,
      );
    }
  }
  return lines.length === 1
    ? 'flowchart LR\n  empty["Add linked model elements to create this diagram"]'
    : lines.join("\n");
}

function renderMarkdown(document: ProblemDefinitionDocumentV1): string {
  return joinSections([
    heading(document.metadata.title, 1),
    `Status: ${document.metadata.status}${document.metadata.projectType ? `  \nProject type: ${document.metadata.projectType}` : ""}`,
    ...sectionCatalog
      .filter((section) => section.mode === "narrative")
      .map((section) =>
        narrativeSection(
          document,
          section.id as keyof ProblemDefinitionDocumentV1["narratives"],
          section.label,
        ),
      ),
    ...entityKinds
      .filter((kind) => document.settings.enabledKinds.includes(kind))
      .map((kind) => entitySection(document, kind)),
  ]);
}

export function renderOutput(
  document: ProblemDefinitionDocumentV1,
  output: OutputTemplate,
): string {
  switch (output) {
    case "working-prompt":
      return renderWorkingPrompt(document);
    case "questionnaire":
      return renderQuestionnaire(document);
    case "problem-brief":
      return renderProblemBrief(document);
    case "alternatives":
      return renderAlternatives(document);
    case "requirements":
      return renderRequirements(document);
    case "markdown":
      return renderMarkdown(document);
    case "json":
      return JSON.stringify(document, null, 2);
    case "context-diagram":
      return diagramForKinds(
        document,
        ["stakeholder", "component", "scope-item"],
        ["affects", "depends-on", "inside-boundary", "outside-boundary"],
      );
    case "flow-diagram":
      return diagramForKinds(
        document,
        ["flow", "component", "stakeholder"],
        ["flows-to", "precedes"],
      );
    case "state-diagram":
      return diagramForKinds(document, ["state", "transition"], ["precedes", "causes"]);
    case "causal-diagram":
      return diagramForKinds(
        document,
        ["symptom", "cause", "contributing-condition", "risk"],
        ["causes", "contributes-to", "mitigates"],
      );
    case "traceability-diagram":
      return diagramForKinds(
        document,
        [
          "evidence",
          "observation",
          "objective",
          "acceptance-criterion",
          "requirement",
          "alternative",
          "evaluation-criterion",
          "decision",
        ],
        ["supports", "satisfies", "verifies", "evaluates", "selected-by"],
      );
  }
}
