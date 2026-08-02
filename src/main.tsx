import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PortableDocumentProvider } from "@mikejhill/portable-document-react";
import { App } from "./App";
import { WorkspaceController } from "./services/workspace-controller";
import { initializeTheme } from "./services/theme-service";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing.");

const controller = new WorkspaceController();
const disposeTheme = initializeTheme();

void controller.initialize().then(() => {
  createRoot(root).render(
    <StrictMode>
      <PortableDocumentProvider engine={controller.engine} disposeOnUnmount={false}>
        <App controller={controller} />
      </PortableDocumentProvider>
    </StrictMode>,
  );
});

window.addEventListener(
  "pagehide",
  () => {
    disposeTheme();
    controller.dispose();
  },
  { once: true },
);
