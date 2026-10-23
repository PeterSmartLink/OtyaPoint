/**
 * Savings-group route handlers for the OmniPoint Cloudflare Worker.
 *
 * This module intentionally has no payment-provider calls. It expects the caller
 * to authenticate the request and pass verified claims before invoking the handler.
 * Register the returned Response only for /api/savings-groups routes.
 */
export interface SavingsD1Statement {
  bind(...values: unknown[]): SavingsD1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface SavingsEnv { DB: { prepare(query: string): SavingsD1Statement; batch<T = unknown>(statements: SavingsD1Statement[]): Promise<T[]> } }
export type SavingsRole = "SOVEREIGN" | "ATTENDANT" | "MANAGER" | "MANAGING_DIRECTOR" | "CHAIRMAN";
export interface SavingsClaims { sub: string; role: SavingsRole }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
const manager = (c: SavingsClaims) => ["SOVEREIGN", "MANAGER", "MANAGING_DIRECTOR", "CHAIRMAN"].includes(c.role);
const id = () => crypto.randomUUID();
const str = (v: unknown, max = 160) => typeof v === "string" ? v.trim().slice(0, max) : "";
const amount = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0;
async function audit(env: SavingsEnv, groupId: string, actorId: string, action: string, type: string, entityId: string | null, requestId: string) {
  await env.DB.prepare(
    "INSERT INTO SavingsGroupAuditEvent (id,groupId,actorId,action,entityType,entityId,requestId) VALUES (?1,?2,?3,?4,?5,?6,?7)"
  ).bind(id(), groupId, actorId, action, type, entityId, requestId).run();
}
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === "object" && !Array.isArray(b) ? b as Record<string, unknown> : null;
  } catch { return null; }
}
async function groupExists(env: SavingsEnv, groupId: string) {
  return !!await env.DB.prepare("SELECT id FROM SavingsGroup WHERE id=?1").bind(groupId).first();
}
async function memberExists(env: SavingsEnv, groupId: string, memberId: string) {
  return !!await env.DB.prepare("SELECT id FROM SavingsGroupMember WHERE groupId=?1 AND id=?2 AND status='ACTIVE'").bind(groupId, memberId).first();
}

/**
 * Returns null for paths not owned by this module; otherwise returns a response.
 * Required caller-side auth: pass already verified claims, never client-supplied roles.
 */
export async function handleSavingsGroups(
  request: Request, env: SavingsEnv, claims: SavingsClaims, requestId: string
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = request.method;
  if (path !== "/api/savings-groups" && !path.startsWith("/api/savings-groups/")) return null;

  if (method === "GET" && path === "/api/savings-groups") {
    const rows = await env.DB.prepare(
      "SELECT id,groupCode,name,description,currency,status,contributionFrequency,shareUnitAmount,createdAt,updatedAt FROM SavingsGroup ORDER BY name LIMIT 200"
    ).all();
    return json({ data: rows.results, requestId });
  }

  if (method === "POST" && path === "/api/savings-groups") {
    if (!manager(claims)) return json({ error: "forbidden", requestId }, 403);
    const b = await readBody(request);
    if (!b) return json({ error: "invalid_json", requestId }, 400);
    const groupCode = str(b.groupCode, 32).toUpperCase();
    const name = str(b.name, 120);
    const description = str(b.description, 500) || null;
    const currency = str(b.currency || "UGX", 3).toUpperCase();
    const frequency = str(b.contributionFrequency || "FLEXIBLE", 16).toUpperCase();
    const shareUnitAmount = b.shareUnitAmount === undefined ? 0 : b.shareUnitAmount;
    if (!/^[A-Z0-9_-]{2,32}$/.test(groupCode) || !name || !/^[A-Z]{3}$/.test(currency) ||
        !["DAILY","WEEKLY","BIWEEKLY","MONTHLY","FLEXIBLE"].includes(frequency) ||
        !Number.isSafeInteger(shareUnitAmount) || (shareUnitAmount as number) < 0) {
      return json({ error: "invalid_group", requestId }, 400);
    }
    const groupId = id();
    try {
      await env.DB.prepare(
        "INSERT INTO SavingsGroup (id,groupCode,name,description,currency,contributionFrequency,shareUnitAmount,createdById) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)"
      ).bind(groupId, groupCode, name, description, currency, frequency, shareUnitAmount, claims.sub).run();
      await audit(env, groupId, claims.sub, "CREATE", "SavingsGroup", groupId, requestId);
      return json({ id: groupId, groupCode, name, currency, status: "ACTIVE", requestId }, 201);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE")) return json({ error: "group_code_conflict", requestId }, 409);
      throw e;
    }
  }

  const groupMatch = path.match(/^\/api\/savings-groups\/([^/]+)$/);
  if (groupMatch && method === "GET") {
    const groupId = decodeURIComponent(groupMatch[1]);
    const group = await env.DB.prepare(
      "SELECT id,groupCode,name,description,currency,status,contributionFrequency,shareUnitAmount,createdAt,updatedAt FROM SavingsGroup WHERE id=?1"
    ).bind(groupId).first();
    if (!group) return json({ error: "group_not_found", requestId }, 404);
    return json({ data: group, requestId });
  }

  const membersPath = path.match(/^\/api\/savings-groups\/([^/]+)\/members$/);
  if (membersPath && method === "GET") {
    const groupId = decodeURIComponent(membersPath[1]);
    if (!await groupExists(env, groupId)) return json({ error: "group_not_found", requestId }, 404);
    const rows = await env.DB.prepare(
      "SELECT id,groupId,memberCode,displayName,phone,status,joinedAt,createdAt FROM SavingsGroupMember WHERE groupId=?1 ORDER BY displayName LIMIT 500"
    ).bind(groupId).all();
    return json({ data: rows.results, requestId });
  }
  if (membersPath && method === "POST") {
    if (!manager(claims)) return json({ error: "forbidden", requestId }, 403);
    const groupId = decodeURIComponent(membersPath[1]);
    if (!await groupExists(env, groupId)) return json({ error: "group_not_found", requestId }, 404);
    const b = await readBody(request);
    if (!b) return json({ error: "invalid_json", requestId }, 400);
    const memberCode = str(b.memberCode, 32).toUpperCase();
    const displayName = str(b.displayName, 120);
    const phone = str(b.phone, 32) || null;
    if (!/^[A-Z0-9_-]{2,32}$/.test(memberCode) || !displayName) return json({ error: "invalid_member", requestId }, 400);
    const memberId = id();
    try {
      await env.DB.prepare(
        "INSERT INTO SavingsGroupMember (id,groupId,memberCode,displayName,phone,createdById) VALUES (?1,?2,?3,?4,?5,?6)"
      ).bind(memberId, groupId, memberCode, displayName, phone, claims.sub).run();
      await audit(env, groupId, claims.sub, "CREATE", "SavingsGroupMember", memberId, requestId);
      return json({ id: memberId, groupId, memberCode, displayName, status: "ACTIVE", requestId }, 201);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE")) return json({ error: "member_code_conflict", requestId }, 409);
      throw e;
    }
  }

  const contributionsPath = path.match(/^\/api\/savings-groups\/([^/]+)\/contributions$/);
  if (contributionsPath && method === "GET") {
    const groupId = decodeURIComponent(contributionsPath[1]);
    if (!await groupExists(env, groupId)) return json({ error: "group_not_found", requestId }, 404);
    const rows = await env.DB.prepare(
      "SELECT id,groupId,memberId,contributionType,amount,currency,paymentMethod,externalReference,status,receivedById,notes,occurredAt,createdAt FROM SavingsContribution WHERE groupId=?1 ORDER BY occurredAt DESC LIMIT 500"
    ).bind(groupId).all();
    return json({ data: rows.results, requestId });
  }
  if (contributionsPath && method === "POST") {
    const groupId = decodeURIComponent(contributionsPath[1]);
    const b = await readBody(request);
    if (!b) return json({ error: "invalid_json", requestId }, 400);
    const memberId = str(b.memberId, 80);
    const contributionType = str(b.contributionType || "SAVING", 24).toUpperCase();
    const paymentMethod = str(b.paymentMethod || "CASH", 20).toUpperCase();
    const key = str(b.idempotencyKey, 120);
    const currency = str(b.currency || "UGX", 3).toUpperCase();
    if (!amount(b.amount) || !memberId || !key || !["SAVING","SHARE_PURCHASE","FEE"].includes(contributionType) ||
        !["CASH","MOBILE_MONEY","BANK","OTHER"].includes(paymentMethod) || !/^[A-Z]{3}$/.test(currency)) {
      return json({ error: "invalid_contribution", requestId }, 400);
    }
    if (!await groupExists(env, groupId)) return json({ error: "group_not_found", requestId }, 404);
    if (!await memberExists(env, groupId, memberId)) return json({ error: "active_member_required", requestId }, 409);
    const contributionId = id();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO SavingsContribution (id,groupId,memberId,contributionType,amount,currency,paymentMethod,externalReference,idempotencyKey,receivedById,notes) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)").bind(contributionId, groupId, memberId, contributionType, b.amount, currency, paymentMethod, str(b.externalReference,120)||null, key, claims.sub, str(b.notes,500)||null),
        env.DB.prepare("INSERT INTO SavingsGroupAuditEvent (id,groupId,actorId,action,entityType,entityId,requestId) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(id(), groupId, claims.sub, "POST", "SavingsContribution", contributionId, requestId)
      ]);
      return json({ id: contributionId, groupId, memberId, amount: b.amount, currency, status: "POSTED", requestId }, 201);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE")) return json({ error: "idempotency_conflict", requestId }, 409);
      throw e;
    }
  }

  const loansPath = path.match(/^\/api\/savings-groups\/([^/]+)\/loans$/);
  if (loansPath && method === "GET") {
    const groupId = decodeURIComponent(loansPath[1]);
    if (!await groupExists(env, groupId)) return json({ error: "group_not_found", requestId }, 404);
    const rows = await env.DB.prepare(
      "SELECT id,groupId,borrowerMemberId,loanCode,principalAmount,interestAmount,feeAmount,penaltyAmount,currency,status,requestedAt,approvedById,approvedAt,disbursedAt,dueAt,createdAt FROM SavingsLoan WHERE groupId=?1 ORDER BY requestedAt DESC LIMIT 300"
    ).bind(groupId).all();
    return json({ data: rows.results, requestId });
  }
  if (loansPath && method === "POST") {
    if (!manager(claims)) return json({ error: "forbidden", requestId }, 403);
    const groupId = decodeURIComponent(loansPath[1]);
    if (!await groupExists(env, groupId)) return json({ error: "group_not_found", requestId }, 404);
    const b = await readBody(request);
    if (!b) return json({ error: "invalid_json", requestId }, 400);
    const borrowerMemberId = str(b.borrowerMemberId, 80);
    const loanCode = str(b.loanCode, 32).toUpperCase();
    const key = str(b.idempotencyKey, 120);
    if (!borrowerMemberId || !/^[A-Z0-9_-]{2,32}$/.test(loanCode) || !key || !amount(b.principalAmount) ||
        !Number.isSafeInteger(b.interestAmount ?? 0) || (Number(b.interestAmount ?? 0) < 0) ||
        !Number.isSafeInteger(b.feeAmount ?? 0) || (Number(b.feeAmount ?? 0) < 0) ||
        !Number.isSafeInteger(b.penaltyAmount ?? 0) || (Number(b.penaltyAmount ?? 0) < 0)) {
      return json({ error: "invalid_loan", requestId }, 400);
    }
    if (!await memberExists(env, groupId, borrowerMemberId)) return json({ error: "active_member_required", requestId }, 409);
    const loanId = id();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO SavingsLoan (id,groupId,borrowerMemberId,loanCode,principalAmount,interestAmount,feeAmount,penaltyAmount,dueAt,idempotencyKey,createdById,notes,status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'PENDING_APPROVAL')").bind(loanId, groupId, borrowerMemberId, loanCode, b.principalAmount, b.interestAmount ?? 0, b.feeAmount ?? 0, b.penaltyAmount ?? 0, str(b.dueAt,40)||null, key, claims.sub, str(b.notes,500)||null),
        env.DB.prepare("INSERT INTO SavingsGroupAuditEvent (id,groupId,actorId,action,entityType,entityId,requestId) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(id(), groupId, claims.sub, "REQUEST", "SavingsLoan", loanId, requestId)
      ]);
      return json({ id: loanId, groupId, borrowerMemberId, loanCode, status: "PENDING_APPROVAL", requestId }, 201);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE")) return json({ error: "loan_code_or_idempotency_conflict", requestId }, 409);
      throw e;
    }
  }

  const loanAction = path.match(/^\/api\/savings-groups\/([^/]+)\/loans\/([^/]+)\/(approve|reject|disburse)$/);
  if (loanAction && method === "POST") {
    if (!manager(claims)) return json({ error: "forbidden", requestId }, 403);
    const [, groupIdRaw, loanIdRaw, action] = loanAction;
    const groupId = decodeURIComponent(groupIdRaw), loanId = decodeURIComponent(loanIdRaw);
    const loan = await env.DB.prepare("SELECT id,status FROM SavingsLoan WHERE id=?1 AND groupId=?2").bind(loanId, groupId).first<{id:string;status:string}>();
    if (!loan) return json({ error: "loan_not_found", requestId }, 404);
    if (action === "approve") {
      if (loan.status !== "PENDING_APPROVAL") return json({ error: "invalid_loan_transition", status: loan.status, requestId }, 409);
      await env.DB.prepare("UPDATE SavingsLoan SET status='APPROVED',approvedById=?1,approvedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updatedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?2 AND groupId=?3 AND status='PENDING_APPROVAL'").bind(claims.sub, loanId, groupId).run();
    } else if (action === "reject") {
      if (loan.status !== "PENDING_APPROVAL") return json({ error: "invalid_loan_transition", status: loan.status, requestId }, 409);
      await env.DB.prepare("UPDATE SavingsLoan SET status='REJECTED',approvedById=?1,approvedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updatedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?2 AND groupId=?3 AND status='PENDING_APPROVAL'").bind(claims.sub, loanId, groupId).run();
    } else {
      // Approval is not disbursement. Until a separately authorized, ledger-backed
      // cash workflow exists, fail closed rather than falsely marking a loan paid out.
      if (loan.status !== "APPROVED") return json({ error: "loan_must_be_approved_first", status: loan.status, requestId }, 409);
      return json({ error: "disbursement_not_enabled", detail: "No cash was moved and the loan remains approved; implement audited ledger posting and cash-balance checks first.", requestId }, 501);
    }
    await audit(env, groupId, claims.sub, action.toUpperCase(), "SavingsLoan", loanId, requestId);
    return json({ id: loanId, status: action === "approve" ? "APPROVED" : "REJECTED", requestId });
  }

  const repaymentPath = path.match(/^\/api\/savings-groups\/([^/]+)\/loans\/([^/]+)\/repayments$/);
  if (repaymentPath && method === "GET") {
    const [, groupRaw, loanRaw] = repaymentPath;
    const groupId = decodeURIComponent(groupRaw), loanId = decodeURIComponent(loanRaw);
    const loan = await env.DB.prepare("SELECT id FROM SavingsLoan WHERE id=?1 AND groupId=?2").bind(loanId, groupId).first();
    if (!loan) return json({ error: "loan_not_found", requestId }, 404);
    const rows = await env.DB.prepare("SELECT id,loanId,amount,principalPortion,interestPortion,feePortion,penaltyPortion,currency,paymentMethod,externalReference,status,receivedById,occurredAt FROM SavingsLoanRepayment WHERE loanId=?1 ORDER BY occurredAt DESC LIMIT 500").bind(loanId).all();
    return json({ data: rows.results, requestId });
  }
  if (repaymentPath && method === "POST") {
    const [, groupRaw, loanRaw] = repaymentPath;
    const groupId = decodeURIComponent(groupRaw), loanId = decodeURIComponent(loanRaw);
    const b = await readBody(request);
    if (!b) return json({ error: "invalid_json", requestId }, 400);
    const key = str(b.idempotencyKey, 120), paymentMethod = str(b.paymentMethod || "CASH", 20).toUpperCase();
    const currency = str(b.currency || "UGX", 3).toUpperCase();
    const principal = b.principalPortion ?? 0, interest = b.interestPortion ?? 0, fee = b.feePortion ?? 0, penalty = b.penaltyPortion ?? 0;
    if (!amount(b.amount) || !key || !["CASH","MOBILE_MONEY","BANK","OTHER"].includes(paymentMethod) ||
        ![principal,interest,fee,penalty].every(v => typeof v === "number" && Number.isSafeInteger(v) && v >= 0) ||
        Number(b.amount) !== Number(principal)+Number(interest)+Number(fee)+Number(penalty) || !/^[A-Z]{3}$/.test(currency)) {
      return json({ error: "invalid_repayment_allocation", requestId }, 400);
    }
    const loan = await env.DB.prepare("SELECT id,status FROM SavingsLoan WHERE id=?1 AND groupId=?2").bind(loanId, groupId).first<{id:string;status:string}>();
    if (!loan) return json({ error: "loan_not_found", requestId }, 404);
    // Approval is not proof of payout. Only a verified disbursement may be repaid.
    if (loan.status !== "DISBURSED") return json({ error: "loan_not_repayable", status: loan.status, requestId }, 409);
    const repaymentId = id();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO SavingsLoanRepayment (id,loanId,amount,principalPortion,interestPortion,feePortion,penaltyPortion,currency,paymentMethod,externalReference,idempotencyKey,receivedById) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)").bind(repaymentId,loanId,b.amount,principal,interest,fee,penalty,currency,paymentMethod,str(b.externalReference,120)||null,key,claims.sub),
        env.DB.prepare("INSERT INTO SavingsGroupAuditEvent (id,groupId,actorId,action,entityType,entityId,requestId) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(id(), groupId, claims.sub, "POST", "SavingsLoanRepayment", repaymentId, requestId)
      ]);
      return json({ id: repaymentId, loanId, amount: b.amount, currency, status: "POSTED", requestId }, 201);
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE")) return json({ error: "idempotency_conflict", requestId }, 409);
      throw e;
    }
  }

  return json({ error: "method_not_allowed", requestId }, 405);
}
