import { createId } from "./commands";
import {
  createEmptyDocument,
  problemDefinitionDocumentSchema,
  type EntityKind,
  type ModelEntity,
  type ProblemDefinitionDocumentV1,
} from "./model";

function entity(
  kind: EntityKind,
  title: string,
  description: string,
  extras: Partial<ModelEntity> = {},
): ModelEntity {
  return {
    id: createId(),
    kind,
    title,
    description,
    classification: "observation",
    confidence: "medium",
    status: "active",
    priority: "unspecified",
    source: "",
    rationale: "",
    verificationMethod: "",
    evidenceIds: [],
    stakeholderIds: [],
    attributes: {},
    ...extras,
  };
}

export function createSampleDocument(): ProblemDefinitionDocumentV1 {
  const document = createEmptyDocument("Neighborhood Tool Library Launch");
  const evidence = entity(
    "evidence",
    "Resident survey",
    "Thirty-two residents reported owning tools they use fewer than twice per year.",
    { classification: "fact", confidence: "high", source: "Resident survey, July 2026" },
  );
  const observation = entity(
    "observation",
    "Tools are duplicated across households",
    "Residents purchase and store similar infrequently used tools.",
    { evidenceIds: [evidence.id], confidence: "high" },
  );
  const stakeholder = entity(
    "stakeholder",
    "Neighborhood residents",
    "Borrowers, lenders, volunteers, and people affected by storage or noise.",
  );
  const objective = entity(
    "objective",
    "Reduce unnecessary tool purchases",
    "Provide reliable access to common tools without requiring individual ownership.",
    { classification: "recommendation", priority: "high" },
  );
  const requirement = entity(
    "requirement",
    "Track every checkout",
    "The operating model must identify the item, borrower, due date, and return state.",
    {
      priority: "critical",
      rationale: "Items must remain findable and available.",
      verificationMethod: "Run a complete checkout and return scenario.",
    },
  );
  const unknown = entity(
    "unknown",
    "Insurance requirements",
    "The liability and insurance requirements for lending power tools have not been verified.",
    {
      status: "blocked",
      confidence: "unknown",
      verificationMethod: "Consult the insurer and municipal guidance.",
    },
  );
  const alternative = entity(
    "alternative",
    "Volunteer-run lending cabinet",
    "Use an existing community room with scheduled pickup windows.",
    { classification: "recommendation" },
  );
  const criterion = entity(
    "evaluation-criterion",
    "Annual operating cost",
    "Compare staffing, space, insurance, maintenance, and replacement costs.",
    { priority: "high" },
  );
  const decision = entity(
    "decision",
    "Select an operating model",
    "Choose whether to run a pilot, partner with an organization, or stop.",
    { classification: "recommendation" },
  );
  const entities = [
    evidence,
    observation,
    stakeholder,
    objective,
    requirement,
    unknown,
    alternative,
    criterion,
    decision,
  ];
  for (const item of entities) {
    document.entities[item.id] = item;
    document.entityOrder[item.kind].push(item.id);
  }
  const relations = [
    {
      id: createId(),
      type: "supports" as const,
      sourceId: evidence.id,
      targetId: observation.id,
      description: "",
      confidence: "high" as const,
    },
    {
      id: createId(),
      type: "satisfies" as const,
      sourceId: requirement.id,
      targetId: objective.id,
      description: "",
      confidence: "medium" as const,
    },
    {
      id: createId(),
      type: "evaluates" as const,
      sourceId: criterion.id,
      targetId: alternative.id,
      description: "",
      confidence: "medium" as const,
    },
    {
      id: createId(),
      type: "selected-by" as const,
      sourceId: alternative.id,
      targetId: decision.id,
      description: "",
      confidence: "low" as const,
    },
  ];
  for (const relation of relations) {
    document.relations[relation.id] = relation;
    document.relationOrder.push(relation.id);
  }
  document.narratives.initialConcern =
    "Residents have proposed sharing infrequently used household tools, but no operating model or accountable owner exists.";
  document.narratives.problemStatement =
    "Residents repeatedly purchase and store similar tools while neighbors lack reliable access, causing avoidable cost and storage burden without a safe sharing process.";
  document.narratives.currentState =
    "Borrowing happens informally through personal messages. Inventory, condition, responsibility, and due dates are not tracked.";
  document.narratives.targetState =
    "Residents can safely find, borrow, and return maintained tools through a financially sustainable process.";
  document.narratives.requestedDecision =
    "Determine whether a six-month tool-library pilot is viable and select the safest practical operating model.";
  document.narratives.requestedDeliverables =
    "Provide a recommended operating model, rejected alternatives, launch sequence, rough costs, risks, and measurable pilot acceptance criteria.";
  document.narratives.responseInstructions =
    "Separate verified evidence from assumptions. State which conclusions require insurance or legal verification.";
  return problemDefinitionDocumentSchema.parse(document);
}
