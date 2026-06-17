import { describe, it, expect, afterEach, vi } from "vitest";
import { decideOpsHost, normalizeHost, isOpsHostAllowed } from "@/lib/ops/host";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("normalizeHost", () => {
  it("strips port, lowercases, takes first of a list", () => {
    expect(normalizeHost("OPS.UNI-KART.COM:443")).toBe("ops.uni-kart.com");
    expect(normalizeHost("localhost:3000")).toBe("localhost");
    expect(normalizeHost("a.com, b.com")).toBe("a.com");
    expect(normalizeHost(null)).toBe("");
  });
});

describe("decideOpsHost in development", () => {
  it("always allows in non-production regardless of host", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(decideOpsHost("localhost:3000").allowed).toBe(true);
    expect(decideOpsHost("uni-kart.com").allowed).toBe(true);
    expect(decideOpsHost("uni-kart.com").reason).toBe("dev");
  });
});

describe("decideOpsHost in production", () => {
  it("allows the configured OPS_HOST", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPS_HOST", "ops.uni-kart.com");
    vi.stubEnv("ALLOW_OPS_ON_PUBLIC_HOST", "false");
    const d = decideOpsHost("ops.uni-kart.com");
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("ops-host");
  });

  it("denies the public/customer host (→ 404)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPS_HOST", "ops.uni-kart.com");
    vi.stubEnv("ALLOW_OPS_ON_PUBLIC_HOST", "false");
    const d = decideOpsHost("uni-kart.com");
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("off-host");
    expect(isOpsHostAllowed("www.uni-kart.com")).toBe(false);
  });

  it("honors the ALLOW_OPS_ON_PUBLIC_HOST escape hatch", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPS_HOST", "ops.uni-kart.com");
    vi.stubEnv("ALLOW_OPS_ON_PUBLIC_HOST", "true");
    const d = decideOpsHost("uni-kart.com");
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe("public-host-override");
  });

  it("denies everything when ENABLE_OPS_CONSOLE=false", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_OPS_CONSOLE", "false");
    vi.stubEnv("OPS_HOST", "ops.uni-kart.com");
    const d = decideOpsHost("ops.uni-kart.com");
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("disabled");
  });
});
