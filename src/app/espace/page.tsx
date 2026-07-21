import { redirect } from "next/navigation";
import EspaceAccessBlocked from "@/components/espace-access-blocked";
import EspaceHub from "@/components/espace-hub";
import {
  canAccessClubOperations,
  canAccessMemberSpace,
  canApproveCoachAbsences,
  canManageSiteData,
  getCurrentUserContext,
  isCoach,
} from "@/lib/clerk";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { readRoleFromClerkUser } from "@/lib/clerk-role";
import { readClubData } from "@/lib/club-data";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { readSiteData } from "@/lib/site-data";
import { buildWeekSchedule } from "@/lib/schedule-week";

export const dynamic = "force-dynamic";

export default async function EspacePage() {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    redirect("/sign-in?redirect_url=/espace");
  }

  const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);
  const disciplines = getActiveDisciplineOptions(siteData);

  const clubOps = canAccessClubOperations(currentUser);
  const manageSite = canManageSiteData(currentUser);
  const coachPortal = isCoach(currentUser);
  const approveAbsences = canApproveCoachAbsences(currentUser);

  const myApplications = clubData.applications.filter(
    (application) => application.clerkUserId === currentUser.userId
  );

  let memberSpace = canAccessMemberSpace(currentUser);
  if (!memberSpace && currentUser.role === "member") {
    const legacyEspaceOk = myApplications.some((application) => {
      const phase = application.dossierPhase;
      return (
        phase === "documents" ||
        phase === "payment" ||
        phase === "finalized" ||
        (application.clerkUserId !== null &&
          !phase &&
          (application.status === "pending" || application.status === "awaiting_document"))
      );
    });
    if (legacyEspaceOk) {
      memberSpace = true;
    }
  }

  if (!memberSpace && !clubOps && !coachPortal) {
    const { userId } = await auth();
    let roleResolution = readRoleFromClerkUser({});
    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      roleResolution = readRoleFromClerkUser(user);
    }
    return <EspaceAccessBlocked roleResolution={roleResolution} />;
  }

  const memberDisciplineIds = new Set(currentUser.disciplineIds);
  for (const application of myApplications) {
    if (application.disciplineId) {
      memberDisciplineIds.add(application.disciplineId);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = siteData.news
    .filter((item) => item.date >= today)
    .filter((item) => !item.disciplineId || memberDisciplineIds.has(item.disciplineId))
    .map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date,
      description: item.description,
      disciplineName: item.disciplineId
        ? siteData.disciplines.find((d) => d.id === item.disciplineId)?.name ?? "Association"
        : "Association",
      kind: item.kind,
      location: item.location,
      startTime: item.startTime,
      endTime: item.endTime,
      imageUrl: item.imageUrl ?? "",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekSchedule = buildWeekSchedule(siteData).filter((entry) =>
    memberDisciplineIds.has(entry.disciplineId)
  );

  let pendingDocument: {
    applicationId: string;
    label: string;
    uploadUrl: string;
  } | null = null;

  const awaitingApp = myApplications.find((a) => a.status === "awaiting_document");
  if (awaitingApp) {
    const token = clubData.documentRequestTokens.find(
      (t) => t.applicationId === awaitingApp.id && !t.usedAt && new Date(t.expiresAt) > new Date()
    );
    if (token) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      pendingDocument = {
        applicationId: awaitingApp.id,
        label: token.requestedDocumentLabel,
        uploadUrl: `${baseUrl}/piece-jointe?token=${token.token}`,
      };
    }
  }

  const coachAbsencePendingCount = clubData.coachAbsenceRequests.filter(
    (r) => r.status === "pending"
  ).length;

  const defaultTab = clubOps ? "cockpit" : coachPortal ? "coach" : "member";

  return (
    <EspaceHub
      canAccessClubOperations={clubOps}
      canManageSite={manageSite}
      canAccessCoachPortal={coachPortal}
      canApproveCoachAbsences={approveAbsences}
      coachAbsencePendingCount={coachAbsencePendingCount}
      membershipStatus={currentUser.membershipStatus}
      hasFullMembership={currentUser.membershipStatus === "approved" || clubOps || coachPortal}
      disciplines={disciplines}
      slots={clubData.trialSlots.filter((slot) => slot.active)}
      myApplications={myApplications}
      allApplications={clubData.applications}
      weekSchedule={weekSchedule}
      upcomingEvents={upcomingEvents}
      pendingDocument={pendingDocument}
      defaultTab={defaultTab}
    />
  );
}
