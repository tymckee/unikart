import { describe, it, expect } from "vitest";
import { sanitizeMetadata, safeJson, snapshot } from "@/lib/ops/sanitize";

describe("sanitizeMetadata", () => {
  it("redacts secret-like and card-like keys (nested too)", () => {
    const clean = sanitizeMetadata({
      email: "a@b.com",
      password: "hunter2",
      apiKey: "sk-123",
      authorization: "Bearer x",
      cardNumber: "4242424242424242",
      nested: { token: "abc", ok: "keep" },
    });
    expect(clean).toMatchObject({
      email: "a@b.com",
      password: "[redacted]",
      apiKey: "[redacted]",
      authorization: "[redacted]",
      cardNumber: "[redacted]",
      nested: { token: "[redacted]", ok: "keep" },
    });
  });

  it("truncates very long strings", () => {
    const long = "x".repeat(2000);
    const clean = sanitizeMetadata({ note: long }) as { note: string };
    expect(clean.note.length).toBeLessThan(1000);
    expect(clean.note.endsWith("…")).toBe(true);
  });

  it("returns null for empty/invalid input", () => {
    expect(sanitizeMetadata(null)).toBeNull();
    expect(sanitizeMetadata(undefined)).toBeNull();
  });

  it("drops functions and caps array length", () => {
    const clean = sanitizeMetadata({
      fn: () => 1,
      arr: Array.from({ length: 100 }, (_, i) => i),
    }) as { fn?: unknown; arr: number[] };
    expect("fn" in clean).toBe(false);
    expect(clean.arr.length).toBeLessThanOrEqual(50);
  });
});

describe("safeJson", () => {
  it("returns a JSON string for non-empty metadata", () => {
    const json = safeJson({ a: 1, secret: "x" });
    expect(json).toContain('"a":1');
    expect(json).toContain("[redacted]");
  });
  it("returns null when nothing to store", () => {
    expect(safeJson(null)).toBeNull();
    expect(safeJson({})).toBeNull();
  });
});

describe("snapshot", () => {
  it("picks only the listed fields and sanitizes", () => {
    const json = snapshot({ status: "active", password: "x", role: "ADMIN" }, ["status", "role"]);
    expect(json).toContain('"status":"active"');
    expect(json).toContain('"role":"ADMIN"');
    expect(json).not.toContain("password");
  });
  it("returns null for null input", () => {
    expect(snapshot(null, ["a"])).toBeNull();
  });
});
