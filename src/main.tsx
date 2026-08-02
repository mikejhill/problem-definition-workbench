import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PortableDocumentProvider } from "@mikejhill/portable-document-react";
import { App } from "./App";
import { WorkspaceController } from "./services/workspace-controller";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing.");

const controller = new WorkspaceController();

void controller.initialize().then(() => {
  createRoot(root).render(
    <StrictMode>
      <PortableDocumentProvider engine={controller.engine} disposeOnUnmount={false}>
        <App controller={controller} />
      </PortableDocumentProvider>
    </StrictMode>,
  );
});

window.addEventListener("pagehide", () => controller.dispose(), { once: true });
