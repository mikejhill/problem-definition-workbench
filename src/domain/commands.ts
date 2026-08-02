import { z } from "zod";
import {
  attachmentSchema,
  entityKindSchema,
  documentMetadataSchema,
  inboxNoteSchema,
  modelEntitySchema,
  modelRelationSchema,
  narrativeSectionSchema,
  outputTemplateSchema,
  problemDefinitionDocumentSchema,
} from "./model";

const metadataPatchSchema = documentMetadataSchema.partial();
const entityPatchSchema = modelEntitySchema.partial().omit({ id: true, kind: true });
const notePatchSchema = inboxNoteSchema.partial().omit({ id: true });
const attachmentPatchSchema = attachmentSchema.partial().omit({ id: true });

export const primitiveCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("patch-metadata"), patch: metadataPatchSchema }),
  z.object({
    type: z.literal("set-narrative"),
    section: narrativeSectionSchema,
    value: z.string().max(50_000),
  }),
  z.object({
    type: z.literal("add-entity"),
    entity: modelEntitySchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("update-entity"),
    entityId: z.string().uuid(),
    patch: entityPatchSchema,
  }),
  z.object({ type: z.literal("delete-entity"), entityId: z.string().uuid() }),
  z.object({
    type: z.literal("move-entity"),
    entityId: z.string().uuid(),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("add-relation"),
    relation: modelRelationSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("delete-relation"), relationId: z.string().uuid() }),
  z.object({ type: z.literal("add-note"), note: inboxNoteSchema }),
  z.object({ type: z.literal("update-note"), noteId: z.string().uuid(), patch: notePatchSchema }),
  z.object({ type: z.literal("delete-note"), noteId: z.string().uuid() }),
  z.object({
    type: z.literal("move-note"),
    noteId: z.string().uuid(),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("add-attachment"),
    attachment: attachmentSchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("update-attachment"),
    attachmentId: z.string().uuid(),
    patch: attachmentPatchSchema,
  }),
  z.object({ type: z.literal("delete-attachment"), attachmentId: z.string().uuid() }),
  z.object({
    type: z.literal("move-attachment"),
    attachmentId: z.string().uuid(),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("convert-note"),
    noteId: z.string().uuid(),
    entity: modelEntitySchema,
    index: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("set-enabled-kinds"), kinds: z.array(entityKindSchema) }),
  z.object({ type: z.literal("set-enabled-outputs"), outputs: z.array(outputTemplateSchema) }),
  z.object({
    type: z.literal("set-output-options"),
    includeConfidence: z.boolean().optional(),
    includeEmptySections: z.boolean().optional(),
  }),
]);

export const problemDefinitionCommandSchema = z.discriminatedUnion("type", [
  ...primitiveCommandSchema.options,
  z.object({
    type: z.literal("apply-batch"),
    label: z.string().min(1).max(160),
    commands: z.array(primitiveCommandSchema).min(1).max(200),
  }),
  z.object({ type: z.literal("replace-document"), document: problemDefinitionDocumentSchema }),
]);

export type PrimitiveProblemDefinitionCommand = z.infer<typeof primitiveCommandSchema>;
export type ProblemDefinitionCommand = z.infer<typeof problemDefinitionCommandSchema>;

export function createId(): string {
  return crypto.randomUUID();
}
