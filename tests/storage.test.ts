import { describe, expect, it } from "vitest";
import { IndexedDbDocumentStore } from "@mikejhill/portable-document-indexeddb";
import { createCommandEnvelope } from "@mikejhill/portable-document-core";
import { IDBFactory } from "fake-indexeddb";
import { problemDefinition } from "../src/domain/definition";
import { createSampleDocument } from "../src/domain/sample";
import type { ProblemDefinitionCommand } from "../src/domain/commands";
import type { ProblemDefinitionDocumentV1, ProblemDefinitionSummary } from "../src/domain/model";

describe("device repository integration", () => {
  it("creates, commits, checkpoints, lists, loads, and deletes validated documents", async () => {
    const store = new IndexedDbDocumentStore<
      ProblemDefinitionDocumentV1,
      ProblemDefinitionCommand,
      ProblemDefinitionSummary
    >(problemDefinition, {
      databaseName: "storage-test",
      indexedDB: new IDBFactory(),
      broadcastChannel: null,
      checkpointLimit: 25,
      now: () => 100,
    });
    const id = crypto.randomUUID();
    const created = await store.create(id, createSampleDocument());
    const envelope = createCommandEnvelope({
      documentId: id,
      documentType: problemDefinition.type,
      baseRevision: created.revision,
      issuedAt: 101,
      command: {
        type: "set-narrative",
        section: "targetState",
        value: "Updated target",
      } satisfies ProblemDefinitionCommand,
    });
    const committed = await store.commit(envelope, "Target Changed");
    expect(committed.ok && committed.snapshot.revision).toBe(2);
    expect((await store.load(id))?.state.narratives.targetState).toBe("Updated target");
    expect(await store.list()).toHaveLength(1);
    expect((await store.listCheckpoints(id)).map((item) => item.reason)).toEqual([
      "Target Changed",
      "Document Created",
    ]);
    await store.delete(id);
    expect(await store.load(id)).toBeNull();
    store.close();
  });
});
