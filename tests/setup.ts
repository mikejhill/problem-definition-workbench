import "@testing-library/jest-dom/vitest";
import { IDBFactory } from "fake-indexeddb";

Object.defineProperty(globalThis, "indexedDB", {
  configurable: true,
  writable: true,
  value: new IDBFactory(),
});

class FakeBroadcastChannel {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public postMessage(): void {}
  public close(): void {}
  public addEventListener(): void {}
  public removeEventListener(): void {}
}

Object.defineProperty(globalThis, "BroadcastChannel", {
  configurable: true,
  writable: true,
  value: FakeBroadcastChannel,
});
