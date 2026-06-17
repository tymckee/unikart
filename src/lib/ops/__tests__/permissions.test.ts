import { describe, it, expect } from "vitest";
import {
  can,
  canAll,
  canAny,
  isOpsRole,
  asRole,
  permissionsFor,
  ALL_PERMISSIONS,
  type Role,
} from "@/lib/ops/permissions";

describe("permissions: roles", () => {
  it("recognizes ops roles and excludes CUSTOMER", () => {
    expect(isOpsRole("OWNER")).toBe(true);
    expect(isOpsRole("ADMIN")).toBe(true);
    expect(isOpsRole("SUPPORT")).toBe(true);
    expect(isOpsRole("FINANCE")).toBe(true);
    expect(isOpsRole("READONLY")).toBe(true);
    expect(isOpsRole("CUSTOMER")).toBe(false);
    expect(isOpsRole("nonsense")).toBe(false);
    expect(isOpsRole(null)).toBe(false);
  });

  it("coerces unknown roles to CUSTOMER", () => {
    expect(asRole("OWNER")).toBe("OWNER");
    expect(asRole("whatever")).toBe("CUSTOMER");
    expect(asRole(undefined)).toBe("CUSTOMER");
  });
});

describe("permissions: can()", () => {
  it("OWNER can do everything", () => {
    const owner = { role: "OWNER" as Role };
    for (const p of ALL_PERMISSIONS) expect(can(owner, p)).toBe(true);
    expect(permissionsFor("OWNER").size).toBe(ALL_PERMISSIONS.length);
  });

  it("CUSTOMER can do nothing", () => {
    const customer = { role: "CUSTOMER" as Role };
    for (const p of ALL_PERMISSIONS) expect(can(customer, p)).toBe(false);
    expect(permissionsFor("CUSTOMER").size).toBe(0);
  });

  it("READONLY can read but not mutate or export", () => {
    const ro = { role: "READONLY" as Role };
    expect(can(ro, "users.read")).toBe(true);
    expect(can(ro, "overview.read")).toBe(true);
    expect(can(ro, "users.mutate")).toBe(false);
    expect(can(ro, "users.disable")).toBe(false);
    expect(can(ro, "users.export")).toBe(false);
    expect(can(ro, "featureFlags.mutate")).toBe(false);
    // every granted permission is a read
    for (const p of permissionsFor("READONLY")) expect(p.endsWith(".read")).toBe(true);
  });

  it("SUPPORT has support powers but no billing/role/flag mutations", () => {
    const s = { role: "SUPPORT" as Role };
    expect(can(s, "support.write")).toBe(true);
    expect(can(s, "users.read")).toBe(true);
    expect(can(s, "parser.retry")).toBe(true);
    expect(can(s, "notifications.resend")).toBe(true);
    expect(can(s, "users.role")).toBe(false);
    expect(can(s, "billing.refund")).toBe(false);
    expect(can(s, "featureFlags.mutate")).toBe(false);
    expect(can(s, "users.disable")).toBe(false);
  });

  it("FINANCE has billing/cost reporting but no customer mutations or support notes", () => {
    const f = { role: "FINANCE" as Role };
    expect(can(f, "billing.read")).toBe(true);
    expect(can(f, "costs.read")).toBe(true);
    expect(can(f, "costs.export")).toBe(true);
    expect(can(f, "users.read")).toBe(true);
    expect(can(f, "support.write")).toBe(false);
    expect(can(f, "users.mutate")).toBe(false);
    expect(can(f, "users.disable")).toBe(false);
  });

  it("ADMIN has most powers but not admin-team management", () => {
    const a = { role: "ADMIN" as Role };
    expect(can(a, "users.disable")).toBe(true);
    expect(can(a, "featureFlags.mutate")).toBe(true);
    expect(can(a, "billing.refund")).toBe(true);
    expect(can(a, "audit.export")).toBe(true);
    expect(can(a, "team.read")).toBe(true);
    expect(can(a, "team.mutate")).toBe(false); // owner-only
  });

  it("only OWNER has team.mutate", () => {
    expect(can({ role: "OWNER" }, "team.mutate")).toBe(true);
    expect(can({ role: "ADMIN" }, "team.mutate")).toBe(false);
  });

  it("rejects null/undefined users", () => {
    expect(can(null, "users.read")).toBe(false);
    expect(can(undefined, "overview.read")).toBe(false);
  });

  it("canAll / canAny behave", () => {
    const s = { role: "SUPPORT" as Role };
    expect(canAll(s, ["users.read", "support.write"])).toBe(true);
    expect(canAll(s, ["users.read", "billing.refund"])).toBe(false);
    expect(canAny(s, ["billing.refund", "support.write"])).toBe(true);
    expect(canAny(s, ["billing.refund", "team.mutate"])).toBe(false);
  });
});
