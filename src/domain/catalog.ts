import type { EntityKind, NarrativeSection, OutputTemplate, RelationType } from "./model";

export type SectionDefinition = {
  readonly id:
    | EntityKind
    | NarrativeSection
    | "identification"
    | "inbox"
    | "relationships"
    | "attachments";
  readonly label: string;
  readonly group: string;
  readonly description: string;
  readonly mode: "metadata" | "narrative" | "entities" | "inbox" | "relations" | "attachments";
};

const narrative: Readonly<Record<NarrativeSection, Omit<SectionDefinition, "id" | "mode">>> = {
  initialConcern: {
    label: "Initial Concern",
    group: "Frame",
    description: "What triggered the analysis and why it matters now.",
  },
  problemStatement: {
    label: "Problem Statement",
    group: "Frame",
    description:
      "The gap between the current and desired conditions, without prescribing a solution.",
  },
  currentState: {
    label: "Current State",
    group: "System",
    description: "How the relevant system currently works or exists.",
  },
  history: {
    label: "History & Change",
    group: "System",
    description: "What changed, what was tried, and how the condition developed.",
  },
  targetState: {
    label: "Target State",
    group: "Outcomes",
    description: "What should be true after the problem is addressed.",
  },
  requestedDecision: {
    label: "Decision Required",
    group: "Decision",
    description: "The exact decision or analysis the final response must resolve.",
  },
  safetyBoundaries: {
    label: "Safety Boundaries",
    group: "Decision",
    description: "Hazards, regulatory limits, and conditions requiring escalation.",
  },
  requestedDeliverables: {
    label: "Requested Deliverables",
    group: "Output",
    description:
      "The sections, calculations, comparisons, and artifacts the response must contain.",
  },
  responseInstructions: {
    label: "Response Instructions",
    group: "Output",
    description: "How uncertainty, citations, terminology, depth, and formatting must be handled.",
  },
};

const entityLabels: Readonly<Record<EntityKind, readonly [string, string, string]>> = {
  impact: [
    "Impacts",
    "Frame",
    "Consequences, affected parties, severity, frequency, and time horizon.",
  ],
  "scope-item": ["Scope", "Frame", "Included, excluded, and conditionally included boundaries."],
  stakeholder: [
    "Stakeholders",
    "System",
    "Roles, interests, concerns, authority, and contributions.",
  ],
  component: [
    "Components",
    "System",
    "Entities inside or outside the boundary and their interfaces.",
  ],
  term: ["Terminology", "System", "Operational definitions for ambiguous or important concepts."],
  evidence: [
    "Evidence",
    "Evidence",
    "Observations, measurements, records, sources, and attachments.",
  ],
  observation: ["Observations", "Evidence", "Directly observed or reported conditions."],
  assumption: [
    "Assumptions",
    "Evidence",
    "Provisional beliefs, consequences if false, and validation methods.",
  ],
  hypothesis: ["Hypotheses", "Evidence", "Testable explanations that remain unconfirmed."],
  unknown: ["Unknowns", "Evidence", "Missing information that affects confidence or action."],
  "open-question": [
    "Open Questions",
    "Evidence",
    "Questions that must be answered during discovery.",
  ],
  flow: [
    "Flows",
    "System",
    "Information, material, energy, money, work, authority, control, load, or risk flows.",
  ],
  scenario: [
    "Scenarios",
    "System",
    "Named normal, failure, peak, maintenance, recovery, and future-state sequences.",
  ],
  state: ["States", "System", "Meaningful conditions the subject can occupy."],
  transition: ["Transitions", "System", "Triggers and rules that move the subject between states."],
  symptom: ["Symptoms", "Causes", "Visible manifestations of the underlying problem."],
  cause: ["Causes", "Causes", "Immediate mechanisms or underlying systemic causes."],
  "contributing-condition": [
    "Contributing Conditions",
    "Causes",
    "Conditions that increase likelihood or severity.",
  ],
  objective: ["Objectives", "Outcomes", "Solution-neutral outcomes that the work should achieve."],
  "acceptance-criterion": [
    "Acceptance Criteria",
    "Outcomes",
    "Observable, testable completion conditions.",
  ],
  requirement: [
    "Requirements",
    "Outcomes",
    "Mandatory conditions with rationale and verification.",
  ],
  preference: ["Preferences", "Outcomes", "Desirable but negotiable characteristics."],
  constraint: [
    "Constraints",
    "Outcomes",
    "Hard limits involving budget, time, labor, access, compatibility, or regulation.",
  ],
  priority: ["Priorities", "Decision", "Ranked goals or decision weights."],
  risk: ["Risks", "Decision", "Uncertain events with likelihood, impact, mitigation, and owner."],
  alternative: ["Alternatives", "Decision", "Candidate interventions, including rejected options."],
  "evaluation-criterion": [
    "Evaluation Criteria",
    "Decision",
    "Consistent dimensions and weights for comparing alternatives.",
  ],
  decision: ["Decisions", "Decision", "Selected outcomes, rationale, authority, and status."],
  "output-requirement": [
    "Output Requirements",
    "Output",
    "Specific content or format required in the generated response.",
  ],
};

export const sectionCatalog: readonly SectionDefinition[] = [
  {
    id: "inbox",
    label: "Inbox",
    group: "Capture",
    description: "Unsorted observations and notes awaiting classification.",
    mode: "inbox",
  },
  {
    id: "identification",
    label: "Identification",
    group: "Frame",
    description: "Project title, type, owner, status, and decision date.",
    mode: "metadata",
  },
  ...Object.entries(narrative).map(([id, value]) => ({
    id: id as NarrativeSection,
    ...value,
    mode: "narrative" as const,
  })),
  ...Object.entries(entityLabels).map(([id, [label, group, description]]) => ({
    id: id as EntityKind,
    label,
    group,
    description,
    mode: "entities" as const,
  })),
  {
    id: "relationships",
    label: "Relationships",
    group: "Synthesis",
    description: "Traceable typed links between model elements.",
    mode: "relations",
  },
  {
    id: "attachments",
    label: "Source Links",
    group: "Synthesis",
    description:
      "Metadata for external evidence and supporting resources. Binary files are not persisted.",
    mode: "attachments",
  },
];

export const relationLabels: Readonly<Record<RelationType, string>> = {
  supports: "supports",
  contradicts: "contradicts",
  "depends-on": "depends on",
  causes: "causes",
  "contributes-to": "contributes to",
  mitigates: "mitigates",
  satisfies: "satisfies",
  verifies: "verifies",
  affects: "affects",
  evaluates: "evaluates",
  "selected-by": "is selected by",
  precedes: "precedes",
  "flows-to": "flows to",
  "inside-boundary": "is inside boundary",
  "outside-boundary": "is outside boundary",
};

export const outputLabels: Readonly<Record<OutputTemplate, string>> = {
  "working-prompt": "Working Prompt",
  questionnaire: "Discovery Questionnaire",
  "problem-brief": "Problem Brief",
  alternatives: "Alternative Evaluation",
  requirements: "Requirements & Traceability",
  markdown: "Complete Markdown",
  json: "Document JSON",
  "context-diagram": "Context Diagram",
  "flow-diagram": "Flow Diagram",
  "state-diagram": "State Diagram",
  "causal-diagram": "Causal Diagram",
  "traceability-diagram": "Traceability Diagram",
};
