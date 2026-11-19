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
import { toMemberApplicationView } from "@/lib/application-route-utils";
import { readClubData } from "@/lib/club-data";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { buildDocumentUploadUrl } from "@/lib/document-request-email";
import { isClosedApplication } from "@/lib/dossier-transitions";
import { listApplicationsNeedingLicenseRenewal } from "@/lib/license-renewal";
import { readSiteData } from "@/lib/site-data";
import { buildDisciplineColors } from "@/lib/discipline-colors";
import { buildPlannerWeeks, findNextSession, listUpcomingSessions } from "@/lib/public-site";
import { buildWeekSchedule, getPublicScheduleReference, todayParisIso } from "@/lib/schedule-week";
import { getApplicationDisciplineIds } from "@/lib/dossier-workflow";

export const dynamic = "force-dynamic";

export default async function EspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
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

  // Les dossiers sont transmis au navigateur : sans les notes internes ni l'historique du bureau.
  const myApplications = clubData.applications
    .filter((application) => application.clerkUserId === currentUser.userId)
    .map(toMemberApplicationView);

  // Accès : compte validé (Clerk) ou bureau/coach. Tolérance à une désynchronisation du compte :
  // un dossier non clos qui a dépassé l'étape « Valider l'espace » donne aussi accès.
  // Jamais pour un dossier refusé ou désinscrit.
  let memberSpace = canAccessMemberSpace(currentUser);
  if (!memberSpace && currentUser.role === "member") {
    memberSpace = myApplications.some((application) => {
      const phase = application.dossierPhase;
      return (
        !isClosedApplication(application) &&
        (phase === "documents" || phase === "payment" || phase === "finalized")
      );
    });
  }

  // Personne désinscrite (tous ses dossiers sont clos) : accès réduit au portail pour pouvoir
  // déposer une nouvelle pré-inscription avec le même compte. Aucun planning ni événement n'y
  // est visible tant qu'aucune inscription n'est finalisée.
  const reRegistrationOnly =
    !memberSpace &&
    currentUser.role === "member" &&
    myApplications.length > 0 &&
    myApplications.every((application) => application.status === "cancelled");

  if (!memberSpace && !reRegistrationOnly && !clubOps && !coachPortal) {
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
    for (const disciplineId of getApplicationDisciplineIds(application)) {
      memberDisciplineIds.add(disciplineId);
    }
  }

  const today = todayParisIso();
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

  const { referenceDate: scheduleReferenceDate } = getPublicScheduleReference();
  const fullWeekSchedule = buildWeekSchedule(siteData, scheduleReferenceDate);
  const weekSchedule = fullWeekSchedule.filter((entry) =>
    memberDisciplineIds.has(entry.disciplineId)
  );

  const disciplineColors = buildDisciplineColors(siteData.disciplines);
  const plannerDisciplines = siteData.disciplines
    .filter((discipline) => discipline.active && memberDisciplineIds.has(discipline.id))
    .map((discipline) => ({
      id: discipline.id,
      name: discipline.name,
      slug: discipline.slug,
      color: disciplineColors[discipline.id]!,
    }));
  const plannerWeeks = buildPlannerWeeks(siteData, scheduleReferenceDate).map((week) => ({
    ...week,
    entries: week.entries.filter((entry) => memberDisciplineIds.has(entry.disciplineId)),
  }));
  const nextSession = findNextSession(plannerWeeks.flatMap((week) => week.entries));
  const bureauUpcomingSessions = clubOps
    ? listUpcomingSessions(
        buildPlannerWeeks(siteData, scheduleReferenceDate, 2).flatMap((week) => week.entries),
        4,
      )
    : [];

  let pendingDocument: {
    applicationId: string;
    label: string;
    uploadUrl: string;
  } | null = null;

  const awaitingApp = myApplications.find((a) => a.status === "awaiting_document");
  if (awaitingApp) {
    const token = clubData.documentRequestTokens
      .filter(
        (t) => t.applicationId === awaitingApp.id && !t.usedAt && new Date(t.expiresAt) > new Date()
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (token) {
      pendingDocument = {
        applicationId: awaitingApp.id,
        label: token.requestedDocumentLabel,
        uploadUrl: buildDocumentUploadUrl(token.token),
      };
    }
  }

  const coachAbsencePendingCount = clubData.coachAbsenceRequests.filter(
    (r) => r.status === "pending"
  ).length;

  const memberRequestPendingCount = (clubData.memberRequests ?? []).filter(
    (r) => r.status === "received" || r.status === "in_progress"
  ).length;

  const contactChangePendingCount = (clubData.contactChangeRequests ?? []).filter(
    (request) => request.status === "pending"
  ).length;

  const latestApplicationId = myApplications.find(
    (application) =>
      application.status !== "rejected" && application.status !== "cancelled"
  )?.id;
  const contactChangeRequest =
    (clubData.contactChangeRequests ?? []).find(
      (request) =>
        request.applicationId === latestApplicationId && request.status === "pending"
    ) ?? null;

  const renewalCount = listApplicationsNeedingLicenseRenewal(clubData.applications).length;
  const newsCount = siteData.news.length;
  const galleryCount = siteData.homeGallery.slides.length;

  const requestedTab =
    tab === "member" || (tab === "cockpit" && clubOps) || (tab === "coach" && coachPortal) ? tab : null;
  const defaultTab = requestedTab ?? (clubOps ? "cockpit" : coachPortal ? "coach" : "member");

  return (
    <EspaceHub
      canAccessClubOperations={clubOps}
      canManageSite={manageSite}
      canAccessCoachPortal={coachPortal}
      canApproveCoachAbsences={approveAbsences}
      coachAbsencePendingCount={coachAbsencePendingCount}
      memberRequestPendingCount={memberRequestPendingCount}
      contactChangePendingCount={contactChangePendingCount}
      renewalCount={renewalCount}
      newsCount={newsCount}
      galleryCount={galleryCount}
      membershipStatus={currentUser.membershipStatus}
      hasFullMembership={currentUser.membershipStatus === "approved" || clubOps || coachPortal}
      disciplines={disciplines}
      slots={clubData.trialSlots.filter((slot) => slot.active)}
      myApplications={myApplications}
      allApplications={clubOps ? clubData.applications : []}
      weekSchedule={weekSchedule}
      plannerWeeks={plannerWeeks}
      plannerDisciplines={plannerDisciplines}
      nextSession={nextSession}
      todayIso={today}
      bureauWeekSchedule={fullWeekSchedule}
      disciplineColors={disciplineColors}
      bureauUpcomingSessions={bureauUpcomingSessions}
      upcomingEvents={upcomingEvents}
      pendingDocument={pendingDocument}
      contactChangeRequest={contactChangeRequest}
      defaultTab={defaultTab}
    />
  );
}
