import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/api-auth";
import { canAccessClubOperations, canAccessMemberSpace, isCoach } from "@/lib/clerk";
import { readRoleFromClerkUser } from "@/lib/clerk-role";

export const dynamic = "force-dynamic";

/** Diagnostic d'accès (utilisateur connecté uniquement). */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }
  const ctx = auth.value;

  const client = await clerkClient();
  const user = await client.users.getUser(ctx.userId);
  const roleResolution = readRoleFromClerkUser(user);

  return NextResponse.json({
    userId: ctx.userId,
    email: user.emailAddresses[0]?.emailAddress ?? null,
    resolved: {
      role: ctx.role,
      membershipStatus: ctx.membershipStatus,
      espaceValidated: ctx.espaceValidated,
      disciplineIds: ctx.disciplineIds,
      canAccessMemberSpace: canAccessMemberSpace(ctx),
      canAccessClubOperations: canAccessClubOperations(ctx),
      isCoach: isCoach(ctx),
    },
    clerk: roleResolution,
  });
}
