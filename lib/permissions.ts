import "server-only";

import type { UserRole } from "@prisma/client";

export type Permission =
  | "retail:read"
  | "retail:sell"
  | "retail:discount"
  | "inventory:read"
  | "inventory:adjust"
  | "agency:read"
  | "agency:record"
  | "agency:reverse"
  | "ledger:read"
  | "ledger:correct"
  | "reconciliation:prepare"
  | "reconciliation:approve"
  | "reports:export"
  | "team:manage"
  | "settings:manage"
  | "security:override";

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  ATTENDANT: new Set([
    "retail:read",
    "retail:sell",
    "inventory:read",
    "agency:read",
    "agency:record",
    "reconciliation:prepare",
  ]),
  MANAGER: new Set([
    "retail:read",
    "retail:sell",
    "retail:discount",
    "inventory:read",
    "inventory:adjust",
    "agency:read",
    "agency:record",
    "agency:reverse",
    "ledger:read",
    "reconciliation:prepare",
    "reports:export",
  ]),
  MANAGING_DIRECTOR: new Set([
    "retail:read",
    "retail:sell",
    "retail:discount",
    "inventory:read",
    "inventory:adjust",
    "agency:read",
    "agency:record",
    "agency:reverse",
    "ledger:read",
    "reconciliation:prepare",
    "reconciliation:approve",
    "reports:export",
    "team:manage",
  ]),
  CHAIRMAN: new Set([
    "retail:read",
    "retail:sell",
    "retail:discount",
    "inventory:read",
    "inventory:adjust",
    "agency:read",
    "agency:record",
    "agency:reverse",
    "ledger:read",
    "ledger:correct",
    "reconciliation:prepare",
    "reconciliation:approve",
    "reports:export",
    "team:manage",
    "settings:manage",
    "security:override",
  ]),
};

/**
 * Server-side policy helper only. Call this after validating an authenticated,
 * active user on the server. This function does not authenticate a caller.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function requirePermission(
  role: UserRole,
  permission: Permission,
): void {
  if (!hasPermission(role, permission)) {
    throw new Error("FORBIDDEN");
  }
}
