import { describe, expect, it } from "vitest";
import { snapshotCodec } from "../src/services/workspace-controller";
import { createSampleDocument } from "../src/domain/sample";

describe("portable snapshot route", () => {
  it("round trips a complete document under #pdw1", () => {
    const document = createSampleDocument();
    const encoded = snapshotCodec.encode(document);
    expect(encoded.startsWith("#pdw1:")).toBe(true);
    const decoded = snapshotCodec.decode(encoded);
    expect(decoded.ok && decoded.state).toEqual(document);
  });

  it("fails closed for corruption and wrong prefixes", () => {
    expect(snapshotCodec.decode("#pdw1:corrupt")).toEqual({
      ok: false,
      failure: { code: "invalid-envelope" },
    });
    expect(snapshotCodec.decode("#other:value")).toEqual({
      ok: false,
      failure: { code: "wrong-prefix" },
    });
  });
});
