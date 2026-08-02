import { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  FileText,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { outputLabels } from "../domain/catalog";
import { analyzeDocument, diagnosticCounts } from "../domain/diagnostics";
import {
  outputTemplateSchema,
  type OutputTemplate,
  type ProblemDefinitionDocumentV1,
} from "../domain/model";
import { renderOutput } from "../domain/renderers";
import { copyText } from "../services/clipboard-service";
import { downloadText } from "../services/file-service";

type InspectorProps = {
  readonly document: ProblemDefinitionDocumentV1;
  readonly focusEntity: (id: string) => void;
  readonly onAi: () => void;
  readonly aiAvailable: boolean;
};

export function Inspector({ document, focusEntity, onAi, aiAvailable }: InspectorProps) {
  const [tab, setTab] = useState<"quality" | "output">("quality");
  return (
    <aside className="inspector">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector views">
        <button
          role="tab"
          aria-selected={tab === "quality"}
          className={tab === "quality" ? "active" : ""}
          onClick={() => setTab("quality")}
        >
          <Check size={15} /> Quality
        </button>
        <button
          role="tab"
          aria-selected={tab === "output"}
          className={tab === "output" ? "active" : ""}
          onClick={() => setTab("output")}
        >
          <FileText size={15} /> Output
        </button>
      </div>
      {tab === "quality" ? (
        <QualityPanel
          document={document}
          focusEntity={focusEntity}
          onAi={onAi}
          aiAvailable={aiAvailable}
        />
      ) : (
        <OutputPanel document={document} />
      )}
    </aside>
  );
}

function QualityPanel({ document, focusEntity, onAi, aiAvailable }: InspectorProps) {
  const diagnostics = useMemo(() => analyzeDocument(document), [document]);
  const counts = diagnosticCounts(diagnostics);
  return (
    <div className="inspector-content">
      <span className="eyebrow">Definition Guidance</span>
      <h2>Quality Signals</h2>
      <p className="muted">Signals expose gaps. They are not a completion score.</p>
      <div className="signal-grid">
        <Signal value={counts["missing-structure"]} label="Missing" tone="red" />
        <Signal value={counts.blocker} label="Blockers" tone="amber" />
        <Signal value={counts.traceability} label="Traceability" tone="blue" />
        <Signal value={counts.contradiction} label="Conflicts" tone="violet" />
      </div>
      <div className="diagnostic-list">
        {diagnostics.length === 0 ? (
          <div className="quality-clear">
            <Check size={18} /> No current diagnostics.
          </div>
        ) : (
          diagnostics.map((item) => (
            <button
              key={item.id}
              className={`diagnostic ${item.severity}`}
              onClick={() => item.entityId && focusEntity(item.entityId)}
              disabled={!item.entityId}
            >
              <AlertTriangle size={15} aria-hidden="true" />
              <span>
                {item.message}
                <small>{item.category.replaceAll("-", " ")}</small>
              </span>
            </button>
          ))
        )}
      </div>
      <button className="ai-callout" onClick={onAi} disabled={!aiAvailable}>
        <Sparkles size={18} aria-hidden="true" />
        <div>
          <strong>{aiAvailable ? "Review with AI" : "AI remains optional"}</strong>
          <p>
            {aiAvailable
              ? "Send the current model for categorization and bounded suggestions."
              : "Manual modeling and every export work without an account or network."}
          </p>
        </div>
      </button>
    </div>
  );
}

function Signal({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={`signal ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function OutputPanel({ document }: { document: ProblemDefinitionDocumentV1 }) {
  const [output, setOutput] = useState<OutputTemplate>("working-prompt");
  const [copied, setCopied] = useState(false);
  const value = useMemo(() => renderOutput(document, output), [document, output]);
  const diagram = output.endsWith("diagram");
  const filename = `${slug(document.metadata.title)}-${output}.${output === "json" ? "json" : output.endsWith("diagram") ? "mmd" : "md"}`;
  return (
    <div className="inspector-content output-panel">
      <span className="eyebrow">Deterministic Projection</span>
      <h2>{outputLabels[output]}</h2>
      <label className="field compact-field">
        <span className="field-label">Output</span>
        <select
          value={output}
          onChange={(event) => setOutput(event.target.value as OutputTemplate)}
        >
          {outputTemplateSchema.options
            .filter((item) => document.settings.enabledOutputs.includes(item))
            .map((item) => (
              <option key={item} value={item}>
                {outputLabels[item]}
              </option>
            ))}
        </select>
      </label>
      <div className="output-actions">
        <button
          onClick={() =>
            void copyText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            })
          }
        >
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={() =>
            downloadText(
              filename,
              value,
              output === "json" ? "application/json" : "text/plain;charset=utf-8",
            )
          }
        >
          <Download size={15} /> Download
        </button>
      </div>
      {diagram ? <MermaidPreview source={value} /> : <pre className="output-preview">{value}</pre>}
    </div>
  );
}

function MermaidPreview({ source }: { source: string }) {
  const rawId = useId();
  const id = `diagram-${rawId.replaceAll(":", "")}`;
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  useEffect(() => {
    let active = true;
    void import("mermaid")
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Inter, system-ui, sans-serif",
        });
        return mermaid.render(id, source);
      })
      .then((result) => {
        if (active) {
          setSvg(result.svg);
          setError("");
        }
      })
      .catch(() => {
        if (active) {
          setError("The current relationships cannot be rendered as a diagram.");
          setSvg("");
        }
      });
    return () => {
      active = false;
    };
  }, [id, source]);
  return error ? (
    <div className="diagram-error">
      <GitBranch size={18} />
      {error}
    </div>
  ) : (
    <div
      className="mermaid-preview"
      aria-label="Generated diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
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
