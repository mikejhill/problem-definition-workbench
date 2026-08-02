import type { EntityKind, ModelEntity, ProblemDefinitionDocumentV1 } from "./model";

export type DiagnosticCategory =
  | "missing-structure"
  | "blocker"
  | "traceability"
  | "contradiction"
  | "enrichment";
export type DiagnosticSeverity = "error" | "warning" | "info";

export type ModelDiagnostic = {
  readonly id: string;
  readonly category: DiagnosticCategory;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly section?: EntityKind;
  readonly entityId?: string;
};

function hasRelation(
  document: ProblemDefinitionDocumentV1,
  entityId: string,
  types: readonly string[],
): boolean {
  return Object.values(document.relations).some(
    (relation) =>
      types.includes(relation.type) &&
      (relation.sourceId === entityId || relation.targetId === entityId),
  );
}

function entryDiagnostic(
  entity: ModelEntity,
  category: DiagnosticCategory,
  severity: DiagnosticSeverity,
  message: string,
): ModelDiagnostic {
  return {
    id: `${category}:${entity.id}:${message}`,
    category,
    severity,
    message,
    section: entity.kind,
    entityId: entity.id,
  };
}

export function analyzeDocument(document: ProblemDefinitionDocumentV1): readonly ModelDiagnostic[] {
  const diagnostics: ModelDiagnostic[] = [];
  if (!document.narratives.problemStatement.trim()) {
    diagnostics.push({
      id: "missing:problem",
      category: "missing-structure",
      severity: "error",
      message: "Define the problem without prescribing a solution.",
    });
  }
  if (!document.narratives.targetState.trim()) {
    diagnostics.push({
      id: "missing:target",
      category: "missing-structure",
      severity: "error",
      message: "Describe the target state.",
    });
  }
  if (!document.narratives.requestedDecision.trim()) {
    diagnostics.push({
      id: "missing:decision",
      category: "missing-structure",
      severity: "warning",
      message: "State the decision or analysis the response must resolve.",
    });
  }
  if (
    !document.narratives.requestedDeliverables.trim() &&
    document.entityOrder["output-requirement"].length === 0
  ) {
    diagnostics.push({
      id: "missing:deliverables",
      category: "missing-structure",
      severity: "warning",
      message: "Specify the required response deliverables.",
    });
  }
  for (const entity of Object.values(document.entities)) {
    if (entity.status === "blocked") {
      diagnostics.push(
        entryDiagnostic(entity, "blocker", "error", `Resolve blocker: ${entity.title}`),
      );
    }
    if (["unknown", "open-question"].includes(entity.kind) && entity.status !== "resolved") {
      diagnostics.push(
        entryDiagnostic(entity, "blocker", "warning", `Unresolved: ${entity.title}`),
      );
    }
    if (
      ["observation", "hypothesis", "cause", "requirement", "decision"].includes(entity.kind) &&
      entity.evidenceIds.length === 0
    ) {
      diagnostics.push(
        entryDiagnostic(
          entity,
          "traceability",
          "warning",
          `${entity.title} has no evidence reference.`,
        ),
      );
    }
    if (entity.kind === "assumption" && !entity.verificationMethod.trim()) {
      diagnostics.push(
        entryDiagnostic(entity, "enrichment", "info", `${entity.title} has no validation method.`),
      );
    }
    if (
      entity.kind === "requirement" &&
      !hasRelation(document, entity.id, ["satisfies", "verifies", "supports"])
    ) {
      diagnostics.push(
        entryDiagnostic(
          entity,
          "traceability",
          "warning",
          `${entity.title} is not traced to an outcome or verification.`,
        ),
      );
    }
    if (
      entity.kind === "alternative" &&
      !hasRelation(document, entity.id, ["evaluates", "selected-by"])
    ) {
      diagnostics.push(
        entryDiagnostic(
          entity,
          "traceability",
          "info",
          `${entity.title} is not linked to an evaluation criterion or decision.`,
        ),
      );
    }
  }
  for (const relation of Object.values(document.relations)) {
    if (relation.type === "contradicts") {
      const source = document.entities[relation.sourceId];
      const target = document.entities[relation.targetId];
      if (source && target && source.status !== "rejected" && target.status !== "rejected") {
        diagnostics.push({
          id: `contradiction:${relation.id}`,
          category: "contradiction",
          severity: "warning",
          message: `${source.title} contradicts ${target.title}.`,
          entityId: source.id,
          section: source.kind,
        });
      }
    }
  }
  return diagnostics;
}

export function diagnosticCounts(
  diagnostics: readonly ModelDiagnostic[],
): Readonly<Record<DiagnosticCategory, number>> {
  return diagnostics.reduce<Readonly<Record<DiagnosticCategory, number>>>(
    (counts, diagnostic) => ({ ...counts, [diagnostic.category]: counts[diagnostic.category] + 1 }),
    { "missing-structure": 0, blocker: 0, traceability: 0, contradiction: 0, enrichment: 0 },
  );
}
