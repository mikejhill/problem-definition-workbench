import { z } from "zod";

export const documentType = "problem-definition-workbench" as const;

export const narrativeSectionSchema = z.enum([
  "initialConcern",
  "problemStatement",
  "currentState",
  "history",
  "targetState",
  "requestedDecision",
  "safetyBoundaries",
  "requestedDeliverables",
  "responseInstructions",
]);

export type NarrativeSection = z.infer<typeof narrativeSectionSchema>;

export const narrativeSections = narrativeSectionSchema.options;

export const entityKindSchema = z.enum([
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
  "output-requirement",
]);

export type EntityKind = z.infer<typeof entityKindSchema>;

export const entityKinds = entityKindSchema.options;

export const classificationSchema = z.enum([
  "fact",
  "observation",
  "inference",
  "assumption",
  "hypothesis",
  "recommendation",
]);

export const confidenceSchema = z.enum(["unknown", "low", "medium", "high", "confirmed"]);
export const entityStatusSchema = z.enum(["draft", "active", "blocked", "resolved", "rejected"]);
export const prioritySchema = z.enum(["unspecified", "low", "medium", "high", "critical"]);

export const modelEntitySchema = z.object({
  id: z.string().uuid(),
  kind: entityKindSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().max(20_000).default(""),
  classification: classificationSchema.default("observation"),
  confidence: confidenceSchema.default("unknown"),
  status: entityStatusSchema.default("active"),
  priority: prioritySchema.default("unspecified"),
  source: z.string().max(2_000).default(""),
  rationale: z.string().max(10_000).default(""),
  verificationMethod: z.string().max(5_000).default(""),
  evidenceIds: z.array(z.string().uuid()).max(100).default([]),
  stakeholderIds: z.array(z.string().uuid()).max(100).default([]),
  attributes: z.record(z.string().max(5_000)).default({}),
});

export type ModelEntity = z.infer<typeof modelEntitySchema>;

export const relationTypeSchema = z.enum([
  "supports",
  "contradicts",
  "depends-on",
  "causes",
  "contributes-to",
  "mitigates",
  "satisfies",
  "verifies",
  "affects",
  "evaluates",
  "selected-by",
  "precedes",
  "flows-to",
  "inside-boundary",
  "outside-boundary",
]);

export type RelationType = z.infer<typeof relationTypeSchema>;

export const modelRelationSchema = z.object({
  id: z.string().uuid(),
  type: relationTypeSchema,
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  description: z.string().max(5_000).default(""),
  confidence: confidenceSchema.default("unknown"),
});

export type ModelRelation = z.infer<typeof modelRelationSchema>;

export const inboxNoteSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(20_000),
  createdAt: z.number().int().nonnegative(),
});

export type InboxNote = z.infer<typeof inboxNoteSchema>;

export const attachmentSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(160),
  url: z.string().url().max(2_000).optional(),
  mediaType: z.string().max(120).default("text/plain"),
  description: z.string().max(5_000).default(""),
});

export type AttachmentReference = z.infer<typeof attachmentSchema>;

export const outputTemplateSchema = z.enum([
  "working-prompt",
  "questionnaire",
  "problem-brief",
  "alternatives",
  "requirements",
  "markdown",
  "json",
  "context-diagram",
  "flow-diagram",
  "state-diagram",
  "causal-diagram",
  "traceability-diagram",
]);

export type OutputTemplate = z.infer<typeof outputTemplateSchema>;

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  projectType: z.string().max(120).default(""),
  owner: z.string().max(160).default(""),
  status: z.enum(["discovering", "defining", "evaluating", "deciding", "complete"]),
  targetDecisionDate: z.string().max(40).default(""),
});

const entityOrderSchema = z.object(
  Object.fromEntries(entityKinds.map((kind) => [kind, z.array(z.string().uuid())])) as Record<
    EntityKind,
    z.ZodArray<z.ZodString>
  >,
);

const narrativesSchema = z.object(
  Object.fromEntries(
    narrativeSections.map((section) => [section, z.string().max(50_000)]),
  ) as Record<NarrativeSection, z.ZodString>,
);

export const problemDefinitionDocumentSchema = z
  .object({
    v: z.literal(1),
    metadata: documentMetadataSchema,
    narratives: narrativesSchema,
    entities: z.record(z.string().uuid(), modelEntitySchema),
    entityOrder: entityOrderSchema,
    relations: z.record(z.string().uuid(), modelRelationSchema),
    relationOrder: z.array(z.string().uuid()),
    inbox: z.array(inboxNoteSchema).max(1_000),
    attachments: z.record(z.string().uuid(), attachmentSchema),
    attachmentOrder: z.array(z.string().uuid()),
    settings: z.object({
      enabledKinds: z.array(entityKindSchema),
      enabledOutputs: z.array(outputTemplateSchema),
      includeConfidence: z.boolean(),
      includeEmptySections: z.boolean(),
    }),
  })
  .superRefine((document, context) => {
    for (const kind of entityKinds) {
      const orderedIds = document.entityOrder[kind];
      if (new Set(orderedIds).size !== orderedIds.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entityOrder", kind],
          message: "Duplicate entity ID.",
        });
      }
      for (const id of orderedIds) {
        if (document.entities[id]?.kind !== kind) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["entityOrder", kind],
            message: "Order references a missing or mismatched entity.",
          });
        }
      }
    }
    for (const [id, entity] of Object.entries(document.entities)) {
      if (!document.entityOrder[entity.kind].includes(id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entities", id],
          message: "Entity is absent from its order.",
        });
      }
      for (const evidenceId of entity.evidenceIds) {
        if (document.entities[evidenceId]?.kind !== "evidence") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["entities", id, "evidenceIds"],
            message: "Evidence reference is invalid.",
          });
        }
      }
      for (const stakeholderId of entity.stakeholderIds) {
        if (document.entities[stakeholderId]?.kind !== "stakeholder") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["entities", id, "stakeholderIds"],
            message: "Stakeholder reference is invalid.",
          });
        }
      }
    }
    for (const relationId of document.relationOrder) {
      const relation = document.relations[relationId];
      if (
        !relation ||
        !document.entities[relation.sourceId] ||
        !document.entities[relation.targetId]
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["relationOrder"],
          message: "Relation reference is invalid.",
        });
      }
    }
    if (new Set(document.relationOrder).size !== document.relationOrder.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relationOrder"],
        message: "Duplicate relation ID.",
      });
    }
    for (const id of document.attachmentOrder) {
      if (!document.attachments[id]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["attachmentOrder"],
          message: "Attachment reference is invalid.",
        });
      }
    }
  });

export type ProblemDefinitionDocumentV1 = z.infer<typeof problemDefinitionDocumentSchema>;

export type ProblemDefinitionSummary = {
  readonly title: string;
  readonly status: ProblemDefinitionDocumentV1["metadata"]["status"];
  readonly entityCount: number;
  readonly unresolvedCount: number;
};

export function emptyEntityOrder(): ProblemDefinitionDocumentV1["entityOrder"] {
  return Object.fromEntries(
    entityKinds.map((kind) => [kind, []]),
  ) as unknown as ProblemDefinitionDocumentV1["entityOrder"];
}

export function emptyNarratives(): ProblemDefinitionDocumentV1["narratives"] {
  return Object.fromEntries(
    narrativeSections.map((section) => [section, ""]),
  ) as ProblemDefinitionDocumentV1["narratives"];
}

export function createEmptyDocument(
  title = "Untitled Problem Definition",
): ProblemDefinitionDocumentV1 {
  return problemDefinitionDocumentSchema.parse({
    v: 1,
    metadata: { title, projectType: "", owner: "", status: "discovering", targetDecisionDate: "" },
    narratives: emptyNarratives(),
    entities: {},
    entityOrder: emptyEntityOrder(),
    relations: {},
    relationOrder: [],
    inbox: [],
    attachments: {},
    attachmentOrder: [],
    settings: {
      enabledKinds: [...entityKinds],
      enabledOutputs: [...outputTemplateSchema.options],
      includeConfidence: true,
      includeEmptySections: false,
    },
  });
}
