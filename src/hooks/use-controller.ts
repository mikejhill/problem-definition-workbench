import { useSyncExternalStore } from "react";
import type { WorkspaceController } from "../services/workspace-controller";

export function useControllerState(controller: WorkspaceController) {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
