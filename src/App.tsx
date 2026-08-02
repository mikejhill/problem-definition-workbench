import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@mikejhill/portable-document-react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  FileWarning,
  ListTree,
  LoaderCircle,
  PanelRight,
  Sparkles,
  SquarePen,
} from "lucide-react";
import type { SectionDefinition } from "./domain/catalog";
import type { ProblemDefinitionCommand } from "./domain/commands";
import type { ProblemDefinitionDocumentV1, ProblemDefinitionSummary } from "./domain/model";
import { renderOutput } from "./domain/renderers";
import { AppHeader } from "./components/AppHeader";
import { Dialog } from "./components/Dialog";
import { Inspector } from "./components/Inspector";
import { Outline } from "./components/Outline";
import { SectionEditor } from "./components/SectionEditor";
import { useControllerState } from "./hooks/use-controller";
import { copyText } from "./services/clipboard-service";
import { downloadText, readTextFile } from "./services/file-service";
import type { WorkspaceController } from "./services/workspace-controller";
import type { AiProposal } from "./services/firebase-services";

export function App({ controller }: { controller: WorkspaceController }) {
  const workspace = useWorkspace<
    ProblemDefinitionDocumentV1,
    ProblemDefinitionCommand,
    ProblemDefinitionSummary
  >();
  const controllerState = useControllerState(controller);
  const [selected, setSelected] = useState<SectionDefinition["id"]>("problemStatement");
  const [dialog, setDialog] = useState<"library" | "history" | "import" | "share" | "ai" | null>(
    null,
  );
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [mobileRegion, setMobileRegion] = useState<"editor" | "inspector">("editor");
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (workspace.status === "idle" || workspace.status === "loading") {
    return (
      <div className="route-state">
        <LoaderCircle className="spin" size={30} />
        <h1>Opening Problem Definition</h1>
      </div>
    );
  }
  if (workspace.status === "error") {
    return (
      <div className="route-state error-state">
        <FileWarning size={36} />
        <span className="eyebrow">{workspace.code}</span>
        <h1>This document could not be opened</h1>
        <p>{workspace.message}</p>
        <button className="primary" onClick={() => void controller.open("#new", true)}>
          Create New Document
        </button>
      </div>
    );
  }

  const document = workspace.snapshot.state;
  const dispatch = (command: ProblemDefinitionCommand) => {
    void controller.dispatch(command).then((error) => {
      if (error) setToast(error);
    });
  };
  const focusEntity = (id: string) => {
    const entity = document.entities[id];
    if (entity) setSelected(entity.kind);
  };
  const copyLink = () => {
    try {
      void copyText(controller.copyPortableUrl())
        .then(() => setToast("Portable editor link copied."))
        .catch(() => setToast("Clipboard access failed."));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "The link could not be created.");
    }
  };
  const exportJson = () =>
    downloadText(
      `${slug(document.metadata.title)}.pdw.json`,
      renderOutput(document, "json"),
      "application/json",
    );

  return (
    <div className="app-shell">
      <AppHeader
        workspace={workspace}
        controllerState={controllerState}
        onNew={() => {
          if (
            window.confirm(
              "Start a new problem definition? The current saved document will remain available.",
            )
          )
            void controller.open("#new", true);
        }}
        onCopyLink={copyLink}
        onExport={exportJson}
        onImport={() => setDialog("import")}
        onLibrary={() => setDialog("library")}
        onHistory={() => setDialog("history")}
        onShare={() => setDialog("share")}
        onAi={() => setDialog("ai")}
        onSignIn={() =>
          void controller
            .signIn()
            .then(() => setToast("Signed in."))
            .catch((error: unknown) =>
              setToast(error instanceof Error ? error.message : "Sign-in failed."),
            )
        }
        onSignOut={() => void controller.signOut().then(() => setToast("Signed out."))}
        onToggleOutline={() => setOutlineOpen(!outlineOpen)}
      />
      {controllerState.message ? (
        <div className={`system-message ${controllerState.saveStatus}`}>
          <AlertTriangle size={15} />
          {controllerState.message}
        </div>
      ) : null}
      {workspace.historicalRevision !== undefined ? (
        <div className="historical-banner">
          Viewing revision {workspace.historicalRevision}. Changes are disabled.
          <button onClick={() => controller.returnToHead()}>
            <ArrowLeft size={15} /> Return to Current
          </button>
        </div>
      ) : null}
      <nav className="mobile-region-tabs" aria-label="Workbench regions">
        <button onClick={() => setOutlineOpen(true)}>
          <ListTree size={16} /> Outline
        </button>
        <button
          className={mobileRegion === "editor" ? "active" : ""}
          aria-current={mobileRegion === "editor" ? "page" : undefined}
          onClick={() => setMobileRegion("editor")}
        >
          <SquarePen size={16} /> Edit
        </button>
        <button
          className={mobileRegion === "inspector" ? "active" : ""}
          aria-current={mobileRegion === "inspector" ? "page" : undefined}
          onClick={() => setMobileRegion("inspector")}
        >
          <PanelRight size={16} /> Review &amp; Output
        </button>
      </nav>
      <div
        className={`workbench ${outlineOpen ? "outline-open" : ""}`}
        data-mobile-region={mobileRegion}
      >
        <div className="outline-wrap">
          <Outline
            document={document}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setOutlineOpen(false);
              setMobileRegion("editor");
            }}
          />
        </div>
        <SectionEditor document={document} sectionId={selected} dispatch={dispatch} />
        <Inspector
          document={document}
          focusEntity={focusEntity}
          onAi={() => setDialog("ai")}
          aiAvailable={controllerState.cloudConfigured}
        />
      </div>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      {dialog === "import" ? (
        <Dialog title="Import Complete Document" onClose={() => setDialog(null)}>
          <p>
            Import replaces the complete open document only after the full JSON file passes
            validation.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void readTextFile(file)
                .then((text) => controller.parseImport(text))
                .then((imported) =>
                  controller.dispatch({ type: "replace-document", document: imported }),
                )
                .then((error) => {
                  if (error) throw new Error(error);
                  setDialog(null);
                  setToast("Complete document imported.");
                })
                .catch((error: unknown) =>
                  setToast(error instanceof Error ? error.message : "Import failed."),
                );
            }}
          />
          <div className="dialog-actions">
            <button className="primary" onClick={() => inputRef.current?.click()}>
              Choose JSON File
            </button>
            <button onClick={() => setDialog(null)}>Cancel</button>
          </div>
        </Dialog>
      ) : null}
      {dialog === "library" ? (
        <LibraryDialog controller={controller} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "history" ? (
        <HistoryDialog controller={controller} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "share" ? (
        <ShareDialog controller={controller} onClose={() => setDialog(null)} notify={setToast} />
      ) : null}
      {dialog === "ai" ? (
        <AiDialog controller={controller} onClose={() => setDialog(null)} notify={setToast} />
      ) : null}
    </div>
  );
}

function ShareDialog({
  controller,
  onClose,
  notify,
}: {
  controller: WorkspaceController;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const copyPublication = (kind: "view" | "launch" | "editor") => {
    setPending(kind);
    void controller
      .publish(kind)
      .then(copyText)
      .then(() =>
        notify(
          `${kind === "view" ? "Public view" : kind === "launch" ? "Public copy" : "Editor invitation"} link copied.`,
        ),
      )
      .catch((error: unknown) => notify(error instanceof Error ? error.message : "Sharing failed."))
      .finally(() => setPending(null));
  };
  return (
    <Dialog title="Share Cloud Document" onClose={onClose}>
      <p>
        Mutable links follow the latest successful cloud save. Anyone holding a public or editor
        link can access plaintext document content.
      </p>
      <div className="share-options">
        <button disabled={pending !== null} onClick={() => copyPublication("view")}>
          <Copy size={17} />
          <span>
            <strong>Copy Public View</strong>
            <small>Read-only and follows future saves.</small>
          </span>
        </button>
        <button disabled={pending !== null} onClick={() => copyPublication("launch")}>
          <Copy size={17} />
          <span>
            <strong>Copy Public Source</strong>
            <small>Opens an independent editable copy.</small>
          </span>
        </button>
        <button disabled={pending !== null} onClick={() => copyPublication("editor")}>
          <Copy size={17} />
          <span>
            <strong>Copy Editor Invitation</strong>
            <small>Grants revocable collaborative edit access.</small>
          </span>
        </button>
      </div>
      <div className="dialog-actions">
        <button onClick={onClose}>Close</button>
      </div>
    </Dialog>
  );
}

function AiDialog({
  controller,
  onClose,
  notify,
}: {
  controller: WorkspaceController;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [pending, setPending] = useState(false);
  const request = () => {
    setPending(true);
    void controller
      .requestAiProposal()
      .then(setProposal)
      .catch((error: unknown) => notify(normalizeAiError(error)))
      .finally(() => setPending(false));
  };
  const accept = () => {
    if (!proposal?.commands.length) return;
    void controller
      .dispatch({
        type: "apply-batch",
        label: "AI Proposal Accepted",
        commands: [...proposal.commands],
      })
      .then((error) => {
        if (error) notify(error);
        else {
          notify("Reviewed AI proposal applied as a checkpoint.");
          onClose();
        }
      });
  };
  return (
    <Dialog title="AI Review" onClose={onClose}>
      {!proposal ? (
        <>
          <div className="ai-disclosure">
            <Sparkles size={20} />
            <div>
              <strong>Explicit cloud analysis</strong>
              <p>
                The current narratives, inbox, model elements, and relationships will be sent to
                Firebase AI Logic. Raw requests and responses are not saved. Suggestions cannot
                change the document until reviewed and accepted.
              </p>
            </div>
          </div>
          <p>
            AI can categorize inbox notes, suggest typed elements and relationships, flag gaps or
            duplicates, and normalize narrative wording. It is not an authority and may be
            unavailable when quota is exhausted.
          </p>
          <div className="dialog-actions">
            <button className="primary" disabled={pending} onClick={request}>
              {pending ? "Reviewing…" : "Send Current Model"}
            </button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <p className="proposal-summary">{proposal.summary}</p>
          <div className="proposal-list">
            {proposal.suggestions.map((item, index) => (
              <article key={`${item.action}-${index}`}>
                <span>{item.action.replaceAll("-", " ")}</span>
                <strong>{item.title ?? item.section ?? item.sourceId ?? "Review note"}</strong>
                <p>{item.rationale}</p>
                {item.replacement ? <blockquote>{item.replacement}</blockquote> : null}
              </article>
            ))}
          </div>
          <div className="proposal-count">
            <Check size={16} />
            {proposal.commands.length} validated change{proposal.commands.length === 1 ? "" : "s"}{" "}
            can be applied.
          </div>
          <div className="dialog-actions">
            <button className="primary" disabled={!proposal.commands.length} onClick={accept}>
              Accept Validated Changes
            </button>
            <button onClick={onClose}>Discard</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function normalizeAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : "AI assistance failed.";
  return /429|quota|resource.exhausted/i.test(message)
    ? "AI quota is currently exhausted. Manual editing and exports remain available."
    : message;
}

function LibraryDialog({
  controller,
  onClose,
}: {
  controller: WorkspaceController;
  onClose: () => void;
}) {
  const [items, setItems] = useState<
    Awaited<ReturnType<WorkspaceController["listDeviceDocuments"]>>
  >([]);
  useEffect(() => {
    void controller.listDeviceDocuments().then(setItems);
  }, [controller]);
  return (
    <Dialog title="On This Device" onClose={onClose}>
      {items.length === 0 ? (
        <p>No device documents exist in this browser.</p>
      ) : (
        <div className="library-list">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                void controller.open(`#pdl1:${item.id}`, true);
                onClose();
              }}
            >
              <strong>{item.summary.title}</strong>
              <span>
                {item.summary.status} · revision {item.revision}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="dialog-actions">
        <button onClick={() => void controller.createDeviceCopy().then(onClose)}>
          Save Current Copy
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    </Dialog>
  );
}

function HistoryDialog({
  controller,
  onClose,
}: {
  controller: WorkspaceController;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Awaited<ReturnType<WorkspaceController["listCheckpoints"]>>>(
    [],
  );
  useEffect(() => {
    void controller.listCheckpoints().then(setItems);
  }, [controller]);
  return (
    <Dialog title="Version History" onClose={onClose}>
      {items.length === 0 ? (
        <p>Version history becomes available after the document is saved on this device.</p>
      ) : (
        <div className="library-list">
          {items.map((item) => (
            <button
              key={`${item.revision}-${item.createdAt}`}
              onClick={() => {
                controller.viewCheckpoint(item);
                onClose();
              }}
            >
              <strong>{item.reason}</strong>
              <span>
                Revision {item.revision} · {new Date(item.createdAt).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="dialog-actions">
        <button onClick={onClose}>Close</button>
      </div>
    </Dialog>
  );
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "problem-definition"
  );
}
