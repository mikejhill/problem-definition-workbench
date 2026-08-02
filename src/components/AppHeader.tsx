import { useState } from "react";
import {
  BookOpen,
  CloudOff,
  Copy,
  FileDown,
  FileUp,
  FolderOpen,
  History,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Save,
  Settings,
  Share2,
  Sparkles,
  SunMoon,
} from "lucide-react";
import type { WorkspaceState } from "@mikejhill/portable-document-core";
import type { ProblemDefinitionDocumentV1, ProblemDefinitionSummary } from "../domain/model";
import type { WorkspaceControllerState } from "../services/workspace-controller";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "../services/theme-service";

type HeaderProps = {
  readonly workspace: Extract<
    WorkspaceState<ProblemDefinitionDocumentV1, ProblemDefinitionSummary>,
    { status: "ready" }
  >;
  readonly controllerState: WorkspaceControllerState;
  readonly onNew: () => void;
  readonly onCopyLink: () => void;
  readonly onExport: () => void;
  readonly onImport: () => void;
  readonly onLibrary: () => void;
  readonly onHistory: () => void;
  readonly onShare: () => void;
  readonly onAi: () => void;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
  readonly onToggleOutline: () => void;
};

export function AppHeader({
  workspace,
  controllerState,
  onNew,
  onCopyLink,
  onExport,
  onImport,
  onLibrary,
  onHistory,
  onShare,
  onAi,
  onSignIn,
  onSignOut,
  onToggleOutline,
}: HeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);
  const storageLabel =
    workspace.source === "device"
      ? "On This Device"
      : workspace.source === "cloud"
        ? "Saved To Account"
        : "Portable URL";
  return (
    <header className="app-header">
      <div className="brand">
        <button
          className="mobile-menu"
          aria-label="Open framework outline"
          onClick={onToggleOutline}
        >
          <Menu size={20} />
        </button>
        <div className="brand-mark" aria-hidden="true">
          <BookOpen size={20} />
        </div>
        <div>
          <strong>Problem Definition</strong>
          <span>Workbench</span>
        </div>
      </div>
      <div className="document-heading">
        <h1 title={workspace.snapshot.state.metadata.title}>
          {workspace.snapshot.state.metadata.title}
        </h1>
        <div className="storage-state">
          {controllerState.saveStatus === "unavailable" ? (
            <CloudOff size={13} />
          ) : (
            <Save size={13} />
          )}
          <span>{storageLabel}</span>
          <span aria-hidden="true">·</span>
          <span className={`save-${controllerState.saveStatus}`}>
            {controllerState.saveStatus.replaceAll("-", " ")}
          </span>
        </div>
      </div>
      <div className="header-actions">
        <button onClick={onCopyLink}>
          <Copy size={16} /> Copy Link
        </button>
        {workspace.source === "cloud" ? (
          <button onClick={onShare}>
            <Share2 size={16} /> Share
          </button>
        ) : null}
        {controllerState.cloudConfigured ? (
          controllerState.principal && !controllerState.principal.anonymous ? (
            <button
              title={controllerState.principal.displayName ?? "Signed in"}
              onClick={onSignOut}
            >
              <LogOut size={16} /> Sign Out
            </button>
          ) : (
            <button onClick={onSignIn}>
              <LogIn size={16} /> Sign In
            </button>
          )
        ) : null}
        <button onClick={onNew}>
          <Plus size={16} /> New
        </button>
        <div className="more-menu">
          <button
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <Settings size={16} /> More
          </button>
          {moreOpen ? (
            <div role="menu" className="menu-popover">
              <button
                role="menuitem"
                onClick={() => {
                  onLibrary();
                  setMoreOpen(false);
                }}
              >
                <FolderOpen size={16} /> Device Library
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onHistory();
                  setMoreOpen(false);
                }}
              >
                <History size={16} /> Version History
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onAi();
                  setMoreOpen(false);
                }}
              >
                <Sparkles size={16} /> AI Review
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onImport();
                  setMoreOpen(false);
                }}
              >
                <FileUp size={16} /> Import JSON
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onExport();
                  setMoreOpen(false);
                }}
              >
                <FileDown size={16} /> Export JSON
              </button>
              <div className="theme-selector" role="none">
                <label htmlFor="theme-preference">
                  <SunMoon size={16} /> Theme
                </label>
                <select
                  id="theme-preference"
                  value={theme}
                  onChange={(event) => {
                    const preference = event.target.value as ThemePreference;
                    setTheme(preference);
                    setThemePreference(preference);
                  }}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
