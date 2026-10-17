"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagement } from "@/lib/management";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allowedRoles = new Set(["ATTENDANT", "MANAGER"]);

export async function inviteStaffAction(formData: FormData) {
  const actor = await requireManagement();
  const displayName = String(formData.get("displayName") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const agentId = String(formData.get("agentId") ?? "").trim().toUpperCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const role = String(formData.get("role") ?? "ATTENDANT");

  if (
    displayName.length < 3 || displayName.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    !/^[A-Z0-9]{6,12}$/.test(agentId) ||
    (phone && phone.length > 32) ||
    !allowedRoles.has(role)
  ) {
    redirect("/management/staff?error=invalid");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { agentId }] },
    select: { id: true },
  });
  if (existing) redirect("/management/staff?error=duplicate");

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    redirect("/management/staff?error=admin-not-configured");
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName, agent_id: agentId },
  });
  if (inviteError || !invited.user) redirect("/management/staff?error=invite-failed");

  try {
    await prisma.$transaction(async (tx) => {
      const staff = await tx.user.create({
        data: {
          email,
          displayName,
          agentId,
          phone: phone || null,
          role: role as "ATTENDANT" | "MANAGER",
          isActive: false,
          identityStatus: "PENDING",
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: "CREATE",
          entityType: "STAFF_INVITATION",
          entityId: staff.id,
          reason: "Management invited staff; identity verification and approval are still required.",
          afterState: {
            email,
            agentId,
            role,
            identityStatus: "PENDING",
            isActive: false,
          },
        },
      });
    });
  } catch {
    // If profile creation/audit fails, remove the invited Auth user so no orphaned invitation remains.
    await admin.auth.admin.deleteUser(invited.user.id).catch(() => undefined);
    redirect("/management/staff?error=profile-failed");
  }

  redirect("/management/staff?success=invited");
}

export async function reviewStaffAction(formData: FormData) {
  const actor = await requireManagement();
  const userId = String(formData.get("userId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");

  if (!userId || !["approve", "reject"].includes(decision)) {
    redirect("/management/staff?error=invalid");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, agentId: true, role: true, isActive: true, identityStatus: true },
  });
  if (!target) redirect("/management/staff?error=not-found");
  if (target.id === actor.id) redirect("/management/staff?error=self-approval");

  const approved = decision === "approve";
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        identityStatus: approved ? "VERIFIED" : "REJECTED",
        isActive: approved,
        approvedAt: approved ? new Date() : null,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: actor.id,
        approverId: approved ? actor.id : null,
        action: approved ? "APPROVE" : "REJECT",
        entityType: "STAFF_IDENTITY",
        entityId: target.id,
        reason: approved
          ? "Management recorded completion of external identity checks and approved staff access."
          : "Management rejected staff identity verification and kept access disabled.",
        beforeState: {
          identityStatus: target.identityStatus,
          isActive: target.isActive,
        },
        afterState: {
          identityStatus: approved ? "VERIFIED" : "REJECTED",
          isActive: approved,
        },
      },
    });
  });

  redirect("/management/staff?success=" + (approved ? "approved" : "rejected"));
}
