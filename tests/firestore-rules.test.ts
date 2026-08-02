import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

const projectId = "problem-definition-workbench-test";
const documentId = "workbench-document";
const ownerId = "owner";
const editorId = "editor";
const viewerId = "viewer";

describe("Portable Document Kit Firestore policy", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: await readFile(
          "node_modules/@mikejhill/portable-document-firebase/rules/firestore.rules",
          "utf8",
        ),
      },
    });
  });

  afterEach(async () => environment.clearFirestore());
  afterAll(async () => environment.cleanup());

  it("allows only verified identities to own valid workbench documents", async () => {
    const owner = database(environment.authenticatedContext(ownerId, verifiedClaims()).firestore());
    const anonymous = database(
      environment.authenticatedContext("guest", anonymousClaims()).firestore(),
    );

    await assertSucceeds(setDoc(document(owner), validEnvelope(ownerId, false)));
    await assertFails(setDoc(document(anonymous), validEnvelope("guest")));
  });

  it("separates viewer, editor, and owner capabilities", async () => {
    await seed(environment);
    const viewer = database(
      environment.authenticatedContext(viewerId, verifiedClaims()).firestore(),
    );
    const editor = database(
      environment.authenticatedContext(editorId, verifiedClaims()).firestore(),
    );
    const owner = database(environment.authenticatedContext(ownerId, verifiedClaims()).firestore());

    await assertSucceeds(getDoc(document(viewer)));
    await assertFails(updateDoc(document(viewer), contentUpdate(2, viewerId)));
    await assertSucceeds(updateDoc(document(editor), contentUpdate(2, editorId)));
    await assertFails(updateDoc(document(editor), { ownerId: editorId }));
    await assertSucceeds(
      updateDoc(document(owner), {
        memberIds: [ownerId, editorId, viewerId, "new-editor"],
        roles: {
          [ownerId]: "owner",
          [editorId]: "editor",
          [viewerId]: "viewer",
          "new-editor": "editor",
        },
        updatedAt: 3,
        updatedBy: ownerId,
      }),
    );
  });

  it("requires monotonic revisions and blocks outsider reads", async () => {
    await seed(environment);
    const editor = database(
      environment.authenticatedContext(editorId, verifiedClaims()).firestore(),
    );
    const outsider = database(
      environment.authenticatedContext("outsider", verifiedClaims()).firestore(),
    );

    await assertFails(updateDoc(document(editor), contentUpdate(4, editorId)));
    await assertFails(getDoc(document(outsider)));
  });

  it("permits token reads but never publication enumeration", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const firestore = database(context.firestore());
      await setDoc(doc(firestore, "pdkPublications", "public-view-token"), {
        schemaVersion: 1,
        documentId,
        kind: "view",
        revision: 1,
        documentType: "problem-definition-workbench",
        documentSchemaVersion: 1,
        state: {},
        summary: {},
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const publicDatabase = database(environment.unauthenticatedContext().firestore());

    await assertSucceeds(getDoc(doc(publicDatabase, "pdkPublications", "public-view-token")));
    await assertFails(getDocs(collection(publicDatabase, "pdkPublications")));
  });
});

function verifiedClaims() {
  return { email_verified: true, email: "user@example.test" };
}

function anonymousClaims() {
  return { email_verified: false, firebase: { sign_in_provider: "anonymous" as const } };
}

function database(value: unknown): Firestore {
  return value as Firestore;
}

function document(firestore: Firestore) {
  return doc(firestore, "pdkDocuments", documentId);
}

function validEnvelope(owner = ownerId, includeCollaborators = true) {
  return {
    schemaVersion: 1,
    documentType: "problem-definition-workbench",
    documentSchemaVersion: 1,
    state: {},
    summary: {},
    ownerId: owner,
    memberIds: owner === ownerId && includeCollaborators ? [ownerId, editorId, viewerId] : [owner],
    roles:
      owner === ownerId && includeCollaborators
        ? { [ownerId]: "owner", [editorId]: "editor", [viewerId]: "viewer" }
        : { [owner]: "owner" },
    revision: 1,
    recentCommandIds: [],
    checkpointRevisions: [1],
    publicationTokens: {},
    lastTargets: [],
    createdAt: 1,
    updatedAt: 1,
    updatedBy: owner,
  };
}

function contentUpdate(revision: number, updatedBy: string) {
  return {
    state: { revision },
    summary: { title: `Revision ${revision}` },
    documentSchemaVersion: 1,
    revision,
    recentCommandIds: [`command-${revision}`],
    checkpointRevisions: [1],
    lastTargets: ["narrative:problemStatement"],
    updatedAt: revision,
    updatedBy,
  };
}

async function seed(environment: RulesTestEnvironment): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(document(database(context.firestore())), validEnvelope());
  });
}
