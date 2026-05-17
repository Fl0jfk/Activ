import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  canAccessClubOperations,
  canAccessMemberSpace,
  getCurrentUserContext,
  isCoach,
} from "@/lib/clerk";
import { readRoleFromClerkUser } from "@/lib/clerk-role";

export const dynamic = "force-dynamic";

/** Diagnostic d'accès (utilisateur connecté uniquement). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Non connecté." }, { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const ctx = await getCurrentUserContext();
  const roleResolution = readRoleFromClerkUser(user);

  return NextResponse.json({
    userId,
    email: user.emailAddresses[0]?.emailAddress ?? null,
    resolved: ctx
      ? {
          role: ctx.role,
          membershipStatus: ctx.membershipStatus,
          espaceValidated: ctx.espaceValidated,
          disciplineIds: ctx.disciplineIds,
          canAccessMemberSpace: canAccessMemberSpace(ctx),
          canAccessClubOperations: canAccessClubOperations(ctx),
          isCoach: isCoach(ctx),
        }
      : null,
    clerk: roleResolution,
  });
}
