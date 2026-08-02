import {
  WorkspaceEngine,
  createCommandEnvelope,
  type DocumentCheckpoint,
  type Member,
  type PublicationKind,
  type DocumentSnapshot,
  type RouteResolution,
  type WorkspaceRouteResolver,
  type WorkspaceState,
} from "@mikejhill/portable-document-core";
import {
  BrowserHistoryPort,
  FragmentRouter,
  createPortableUrl,
} from "@mikejhill/portable-document-browser";
import { LzStringUriCompression, PortableSnapshotCodec } from "@mikejhill/portable-document-codec";
import { IndexedDbDocumentStore } from "@mikejhill/portable-document-indexeddb";
import { IndexedDbOutboxStore } from "@mikejhill/portable-document-indexeddb";
import { OccReplicationEngine } from "@mikejhill/portable-document-sync";
import type { FirebasePrincipal } from "@mikejhill/portable-document-firebase";
import { problemDefinition } from "../domain/definition";
import { createId, type ProblemDefinitionCommand } from "../domain/commands";
import {
  createEmptyDocument,
  documentType,
  problemDefinitionDocumentSchema,
  type ProblemDefinitionDocumentV1,
  type ProblemDefinitionSummary,
} from "../domain/model";
import { createSampleDocument } from "../domain/sample";
import type { AiProposal, FirebaseServices } from "./firebase-services";
import { firebaseIsConfigured, loadFirebaseServices } from "./firebase-loader";

export type SaveStatus = "saved" | "saving" | "offline-pending" | "conflict" | "unavailable";

export type WorkspaceControllerState = {
  readonly saveStatus: SaveStatus;
  readonly urlOnly: boolean;
  readonly cloudConfigured: boolean;
  readonly principal: FirebasePrincipal | null;
  readonly message?: string;
};

function failureMessage(failure: { readonly code: string; readonly message?: string }): string {
  return failure.message ?? `The change was rejected (${failure.code}).`;
}

export const snapshotCodec = new PortableSnapshotCodec({
  prefix: "#pdw1:",
  definition: problemDefinition,
  compression: new LzStringUriCompression(),
  maxEncodedCharacters: 120_000,
  maxDecodedCharacters: 2_000_000,
});

export const routeParser = new FragmentRouter([
  { kind: "snapshot", prefix: "#pdw1:" },
  { kind: "local", prefix: "#pdl1:", identifier: /^[a-f\d-]{36}$/i },
  { kind: "private", prefix: "#pdb1:", identifier: /^[a-f\d-]{36}$/i },
  { kind: "view", prefix: "#pdv1:" },
  { kind: "launch", prefix: "#pdp1:" },
  { kind: "invitation", prefix: "#pdi1:" },
  { kind: "action", prefix: "#new" },
]);

function urlSnapshot(
  id: string,
  state: ProblemDefinitionDocumentV1,
): DocumentSnapshot<ProblemDefinitionDocumentV1, ProblemDefinitionSummary> {
  const now = Date.now();
  return {
    id,
    documentType,
    schemaVersion: 1,
    state,
    summary: problemDefinition.summarize(state),
    revision: 0,
    createdAt: now,
    updatedAt: now,
    appliedCommandIds: [],
    lastTargets: [],
  };
}

class WorkbenchRouteResolver implements WorkspaceRouteResolver<
  ProblemDefinitionDocumentV1,
  ProblemDefinitionSummary
> {
  public constructor(
    private readonly deviceStore: IndexedDbDocumentStore<
      ProblemDefinitionDocumentV1,
      ProblemDefinitionCommand,
      ProblemDefinitionSummary
    >,
    private readonly cloud: () => Promise<FirebaseServices>,
  ) {}

  public async resolve(
    route: string,
    signal: AbortSignal,
  ): Promise<RouteResolution<ProblemDefinitionDocumentV1, ProblemDefinitionSummary>> {
    signal.throwIfAborted();
    if (route === "#new") {
      return {
        ok: true,
        value: {
          snapshot: urlSnapshot(createId(), createEmptyDocument()),
          source: "url",
          readOnly: false,
        },
      };
    }
    if (!route) {
      return {
        ok: true,
        value: {
          snapshot: urlSnapshot(createId(), createSampleDocument()),
          source: "url",
          readOnly: false,
        },
      };
    }
    const parsed = routeParser.parse(route);
    if (!parsed) {
      return {
        ok: false,
        code: routeParser.hasKnownPrefix(route) ? "corrupt" : "not-found",
        message: "This link is malformed or uses an unknown route.",
      };
    }
    if (parsed.kind === "snapshot") {
      const decoded = snapshotCodec.decode(route);
      return decoded.ok
        ? {
            ok: true,
            value: {
              snapshot: urlSnapshot(createId(), decoded.state),
              source: "url",
              readOnly: false,
            },
          }
        : {
            ok: false,
            code: decoded.failure.code === "incompatible-version" ? "incompatible" : "corrupt",
            message: `The portable document could not be opened (${decoded.failure.code}).`,
          };
    }
    if (parsed.kind === "local") {
      try {
        const snapshot = await this.deviceStore.load(parsed.value);
        return snapshot
          ? { ok: true, value: { snapshot, source: "device", readOnly: false } }
          : {
              ok: false,
              code: "not-found",
              message: "This device document no longer exists in this browser.",
            };
      } catch {
        return { ok: false, code: "unavailable", message: "On-device storage is unavailable." };
      }
    }
    if (!firebaseIsConfigured)
      return {
        ok: false,
        code: "unavailable",
        message:
          "Cloud collaboration is not configured for this deployment. The link was not replaced.",
      };
    try {
      const cloud = await this.cloud();
      const auth = await cloud.waitForAuthReady();
      if (parsed.kind === "private") {
        if (!auth.principal)
          return {
            ok: false,
            code: "unauthorized",
            message: "Sign in with an authorized account to open this private document.",
          };
        const snapshot = await cloud.store.load(parsed.value);
        return snapshot
          ? { ok: true, value: { snapshot, source: "cloud", readOnly: false } }
          : { ok: false, code: "not-found", message: "This cloud document no longer exists." };
      }
      if (parsed.kind === "view" || parsed.kind === "launch") {
        const resolved = await cloud.store.resolve(parsed.value);
        if (!resolved)
          return { ok: false, code: "revoked", message: "This public link is missing or revoked." };
        return parsed.kind === "view"
          ? {
              ok: true,
              value: { snapshot: resolved.snapshot, source: "publication", readOnly: true },
            }
          : {
              ok: true,
              value: {
                snapshot: urlSnapshot(createId(), resolved.snapshot.state),
                source: "url",
                readOnly: false,
              },
            };
      }
      if (parsed.kind === "invitation") {
        if (!auth.principal) await cloud.ensureAnonymous();
        const documentId = await cloud.store.acceptEditorInvitation(parsed.value);
        const snapshot = await cloud.store.load(documentId);
        return snapshot
          ? { ok: true, value: { snapshot, source: "invitation", readOnly: false } }
          : {
              ok: false,
              code: "revoked",
              message: "This editor invitation is missing or revoked.",
            };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The cloud provider failed.";
      return {
        ok: false,
        code: /permission|auth|sign in|verified/i.test(message)
          ? "unauthorized"
          : /revoked|missing/i.test(message)
            ? "revoked"
            : "unavailable",
        message,
      };
    }
    return { ok: false, code: "not-found", message: "This route is not supported." };
  }
}

export class WorkspaceController {
  public readonly deviceStore = new IndexedDbDocumentStore(problemDefinition, {
    databaseName: "problem-definition-workbench",
    checkpointLimit: 25,
  });
  public readonly outboxStore = new IndexedDbOutboxStore<ProblemDefinitionCommand>({
    databaseName: "problem-definition-workbench",
  });
  public readonly engine = new WorkspaceEngine(
    problemDefinition,
    new WorkbenchRouteResolver(this.deviceStore, () => this.ensureCloud()),
  );
  private readonly history = new BrowserHistoryPort(window);
  private readonly listeners = new Set<() => void>();
  private controllerState: WorkspaceControllerState = {
    saveStatus: "saved",
    urlOnly: false,
    cloudConfigured: firebaseIsConfigured,
    principal: null,
  };
  private removeHistoryListener: (() => void) | null = null;
  private removeDeviceListener: (() => void) | null = null;
  private cloudServices: FirebaseServices | null = null;
  private removeAuthListener: (() => void) | null = null;
  private replication: OccReplicationEngine<
    ProblemDefinitionDocumentV1,
    ProblemDefinitionCommand,
    ProblemDefinitionSummary
  > | null = null;
  private removeReplicationListener: (() => void) | null = null;
  private removeCloudListener: (() => void) | null = null;

  public getSnapshot = (): WorkspaceControllerState => this.controllerState;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public async initialize(): Promise<void> {
    this.removeHistoryListener = this.history.subscribe((hash) => void this.open(hash, false));
    await this.open(window.location.hash, false);
  }

  public async open(route: string, writeHistory = true): Promise<void> {
    this.disposeReplication();
    this.removeDeviceListener?.();
    this.removeDeviceListener = null;
    if (writeHistory) this.history.write(route, "push");
    await this.engine.open(route);
    const workspace = this.engine.getSnapshot();
    if (workspace.status === "ready" && workspace.source === "device") {
      this.removeDeviceListener = this.deviceStore.subscribe(workspace.snapshot.id, (snapshot) => {
        this.engine.acceptHead(snapshot);
        this.setControllerState({ ...this.controllerState, saveStatus: "saved", urlOnly: false });
      });
    }
    if (
      workspace.status === "ready" &&
      !workspace.readOnly &&
      (workspace.source === "cloud" ||
        workspace.source === "invitation" ||
        workspace.source === "publication")
    ) {
      await this.setupReplication(workspace.snapshot);
    }
    this.setControllerState({
      ...this.controllerState,
      saveStatus: "saved",
      urlOnly:
        workspace.status === "ready" && workspace.source === "url" && this.controllerState.urlOnly,
    });
  }

  public async dispatch(command: ProblemDefinitionCommand): Promise<string | null> {
    const workspace = this.engine.getSnapshot();
    if (workspace.status !== "ready") return "No editable document is open.";
    if (workspace.readOnly) return "This document is read-only.";
    const envelope = createCommandEnvelope({
      documentId: workspace.snapshot.id,
      documentType,
      baseRevision: workspace.snapshot.revision,
      command,
    });
    const failure = this.engine.applySpeculative(envelope);
    if (failure) {
      const message = failureMessage(failure);
      this.setControllerState({ ...this.controllerState, saveStatus: "conflict", message });
      return message;
    }
    const visible = this.engine.getSnapshot();
    if (visible.status !== "ready") return "The document changed while applying the command.";
    if (workspace.source === "url") {
      if (!this.controllerState.urlOnly && this.isMeaningful(command)) {
        this.setControllerState({ ...this.controllerState, saveStatus: "saving" });
        try {
          if (
            this.controllerState.principal?.verified &&
            !this.controllerState.principal.anonymous
          ) {
            const id = createId();
            await (await this.ensureCloud()).store.create(id, visible.snapshot.state);
            await this.open(`#pdb1:${id}`, true);
          } else {
            const id = createId();
            await this.deviceStore.create(id, visible.snapshot.state);
            await this.open(`#pdl1:${id}`, true);
          }
          return null;
        } catch {
          this.setControllerState({
            ...this.controllerState,
            saveStatus: "unavailable",
            message: "On-device storage failed. The portable document remains open.",
          });
          this.replaceSnapshotHash(visible.snapshot.state);
          return "On-device storage failed. The portable document remains open.";
        }
      }
      this.replaceSnapshotHash(visible.snapshot.state);
      this.setControllerState({ ...this.controllerState, saveStatus: "saved" });
      return null;
    }
    if (workspace.source === "device") {
      this.setControllerState({
        ...this.controllerState,
        saveStatus: "saving",
        urlOnly: this.controllerState.urlOnly,
      });
      try {
        const metadata = problemDefinition.commandPolicy.inspect(command);
        const committed = await this.deviceStore.commit(envelope, metadata.checkpointReason);
        if (!committed.ok) {
          const message = failureMessage(committed.failure);
          this.setControllerState({ ...this.controllerState, saveStatus: "conflict", message });
          return message;
        }
        this.engine.acceptHead(committed.snapshot);
        this.setControllerState({ ...this.controllerState, saveStatus: "saved", urlOnly: false });
        return null;
      } catch {
        this.setControllerState({
          ...this.controllerState,
          saveStatus: "unavailable",
          message: "The change could not be saved on this device.",
        });
        return "The change could not be saved on this device.";
      }
    }
    if (
      (workspace.source === "cloud" ||
        workspace.source === "invitation" ||
        workspace.source === "publication") &&
      this.replication
    ) {
      const failed = await this.replication.dispatch(command, {
        ...(problemDefinition.commandPolicy.inspect(command).checkpointReason
          ? { checkpointReason: problemDefinition.commandPolicy.inspect(command).checkpointReason }
          : {}),
        ...(this.controllerState.principal ? { actorId: this.controllerState.principal.id } : {}),
      });
      if (failed) {
        const message = failureMessage(failed);
        this.setControllerState({ ...this.controllerState, saveStatus: "conflict", message });
        return message;
      }
      return null;
    }
    return "Cloud editing is unavailable in this deployment.";
  }

  public keepUrlOnly(): void {
    const workspace = this.engine.getSnapshot();
    if (workspace.status !== "ready" || workspace.source !== "url") return;
    this.setControllerState({ ...this.controllerState, saveStatus: "saved", urlOnly: true });
    this.replaceSnapshotHash(workspace.snapshot.state);
  }

  public copyPortableUrl(): string {
    const workspace = this.requireReady();
    return createPortableUrl(snapshotCodec, workspace.snapshot.state, window.location.href);
  }

  public async createDeviceCopy(): Promise<void> {
    const workspace = this.requireReady();
    const id = createId();
    await this.deviceStore.create(id, workspace.snapshot.state);
    await this.open(`#pdl1:${id}`, true);
  }

  public async signIn(): Promise<void> {
    const cloud = await this.ensureCloud();
    await cloud.signIn();
  }

  public async signOut(): Promise<void> {
    if (!this.cloudServices) return;
    await this.cloudServices.signOut();
  }

  public async saveToAccount(): Promise<void> {
    const workspace = this.requireReady();
    const principal = (await this.ensureCloud()).getSnapshot().principal;
    if (!principal?.verified || principal.anonymous)
      throw new Error("Sign in with a verified account first.");
    const id = createId();
    await (await this.ensureCloud()).store.create(id, workspace.snapshot.state);
    await this.open(`#pdb1:${id}`, true);
  }

  public async listCloudDocuments() {
    return (await this.ensureCloud()).store.list();
  }

  public async publish(kind: PublicationKind, rotate = false): Promise<string> {
    const workspace = this.requireReady();
    if (workspace.source !== "cloud")
      throw new Error("Save the document to your account before sharing a mutable cloud link.");
    const publication = await (
      await this.ensureCloud()
    ).store.publish(workspace.snapshot.id, kind, rotate);
    const prefix = kind === "view" ? "#pdv1:" : kind === "launch" ? "#pdp1:" : "#pdi1:";
    return `${window.location.href.split("#", 1)[0]}${prefix}${publication.token}`;
  }

  public async revokePublication(kind: PublicationKind): Promise<void> {
    const workspace = this.requireReady();
    await (await this.ensureCloud()).store.revoke(workspace.snapshot.id, kind);
  }

  public async listMembers(): Promise<readonly Member[]> {
    const workspace = this.requireReady();
    return (await this.ensureCloud()).store.listMembers(workspace.snapshot.id);
  }

  public async setMember(member: Member): Promise<void> {
    const workspace = this.requireReady();
    await (await this.ensureCloud()).store.setMember(workspace.snapshot.id, member);
  }

  public async removeMember(principalId: string): Promise<void> {
    const workspace = this.requireReady();
    await (await this.ensureCloud()).store.removeMember(workspace.snapshot.id, principalId);
  }

  public async requestAiProposal(): Promise<AiProposal> {
    return (await this.ensureCloud()).requestAiProposal(this.requireReady().snapshot.state);
  }

  public async listDeviceDocuments() {
    return this.deviceStore.list();
  }

  public async listCheckpoints(): Promise<
    readonly DocumentCheckpoint<ProblemDefinitionDocumentV1>[]
  > {
    const workspace = this.requireReady();
    if (workspace.source !== "device") return [];
    return this.deviceStore.listCheckpoints(workspace.snapshot.id);
  }

  public viewCheckpoint(checkpoint: DocumentCheckpoint<ProblemDefinitionDocumentV1>): void {
    const workspace = this.requireReady();
    this.engine.viewHistorical({
      ...workspace.snapshot,
      state: checkpoint.state,
      summary: problemDefinition.summarize(checkpoint.state),
      revision: checkpoint.revision,
      updatedAt: checkpoint.createdAt,
    });
  }

  public returnToHead(): void {
    this.engine.returnToHead();
  }

  public parseImport(value: string): ProblemDefinitionDocumentV1 {
    return problemDefinitionDocumentSchema.parse(JSON.parse(value) as unknown);
  }

  public dispose(): void {
    this.removeHistoryListener?.();
    this.removeDeviceListener?.();
    this.engine.dispose();
    this.deviceStore.close();
    this.outboxStore.close();
    this.disposeReplication();
    this.removeAuthListener?.();
  }

  private replaceSnapshotHash(state: ProblemDefinitionDocumentV1): void {
    try {
      this.history.write(snapshotCodec.encode(state), "replace");
    } catch {
      this.setControllerState({
        ...this.controllerState,
        saveStatus: "unavailable",
        message:
          "This document is too large for a portable URL. Save it on this device or export JSON.",
      });
    }
  }

  private isMeaningful(command: ProblemDefinitionCommand): boolean {
    return !["set-enabled-kinds", "set-enabled-outputs", "set-output-options"].includes(
      command.type,
    );
  }

  private requireReady(): Extract<
    WorkspaceState<ProblemDefinitionDocumentV1, ProblemDefinitionSummary>,
    { status: "ready" }
  > {
    const workspace = this.engine.getSnapshot();
    if (workspace.status !== "ready") throw new Error("No document is ready.");
    return workspace;
  }

  private async ensureCloud(): Promise<FirebaseServices> {
    if (this.cloudServices) return this.cloudServices;
    this.cloudServices = await loadFirebaseServices();
    this.removeAuthListener = this.cloudServices.subscribe(() => {
      this.setControllerState({
        ...this.controllerState,
        principal: this.cloudServices?.getSnapshot().principal ?? null,
      });
    });
    const principal = this.cloudServices.getSnapshot().principal;
    this.setControllerState({ ...this.controllerState, principal });
    return this.cloudServices;
  }

  private async setupReplication(
    snapshot: DocumentSnapshot<ProblemDefinitionDocumentV1, ProblemDefinitionSummary>,
  ): Promise<void> {
    const cloud = await this.ensureCloud();
    this.replication = new OccReplicationEngine(
      problemDefinition,
      snapshot,
      cloud.store,
      this.outboxStore,
    );
    this.removeReplicationListener = this.replication.subscribe(() => {
      const replication = this.replication?.getSnapshot();
      if (!replication) return;
      this.engine.acceptHead(replication.visible);
      const status: SaveStatus =
        replication.status === "clean"
          ? "saved"
          : replication.status === "offline"
            ? "offline-pending"
            : replication.status === "conflict"
              ? "conflict"
              : replication.status === "unavailable"
                ? "unavailable"
                : "saving";
      this.setControllerState({ ...this.controllerState, saveStatus: status });
    });
    this.removeCloudListener = cloud.store.subscribe(snapshot.id, (remote) => {
      void this.replication?.receiveRemote(remote);
    });
    await this.replication.restorePending();
    void this.replication.flush();
  }

  private disposeReplication(): void {
    this.removeReplicationListener?.();
    this.removeCloudListener?.();
    this.removeReplicationListener = null;
    this.removeCloudListener = null;
    this.replication?.dispose();
    this.replication = null;
  }

  private setControllerState(state: WorkspaceControllerState): void {
    this.controllerState = state;
    for (const listener of this.listeners) listener();
  }
}
