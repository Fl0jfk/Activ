import BureauPageHeader from "@/components/bureau-page-header";
import CoachAbsencePanel from "@/components/coach-absence-panel";
import PlanningTabs, { type PlanningTabId } from "@/components/planning-tabs";
import PlanningWeekView from "@/components/planning-week-view";
import TrialSlotsPanel from "@/components/trial-slots-panel";
import { requireBureauPageAccess } from "@/lib/bureau-page-data";
import { readClubData } from "@/lib/club-data";
import { listPendingCoachAbsences, listRecentCoachAbsences } from "@/lib/coach-absence";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { countApprovedMemberEmails } from "@/lib/member-emails";
import type { PlanningWeek } from "@/lib/planning-types";
import {
  addDaysToIsoDate,
  buildWeekScheduleForMonday,
  formatDayLabelFr,
  formatWeekRangeShort,
  getCurrentWeekRangeParis,
  getPublicScheduleReference,
  todayParisIso,
} from "@/lib/schedule-week";
import { readSiteData } from "@/lib/site-data";
import { buildTrialSlotRows } from "@/lib/trial-slots";

export const dynamic = "force-dynamic";

/** Nombre de semaines proposées dans le calendrier (calculées sur le serveur, à l'heure de Paris). */
const WEEK_COUNT = 10;

function parseTab(value: string | string[] | undefined): PlanningTabId {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "essais" || raw === "absences" ? raw : "semaine";
}

export default async function BureauPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string | string[] }>;
}) {
  const access = await requireBureauPageAccess();
  const [siteData, clubData, query] = await Promise.all([readSiteData(), readClubData(), searchParams]);

  const requestedTab = parseTab(query.onglet);
  const initialTab: PlanningTabId =
    requestedTab === "absences" && !access.canApproveCoachAbsences ? "semaine" : requestedTab;

  const todayIso = todayParisIso();
  const reference = getPublicScheduleReference();
  const firstMonday = getCurrentWeekRangeParis(reference.referenceDate).monday;
  const weeks: PlanningWeek[] = Array.from({ length: WEEK_COUNT }, (_, index) => {
    const monday = addDaysToIsoDate(firstMonday, index * 7);
    return {
      startIso: monday,
      label: formatWeekRangeShort(monday),
      entries: buildWeekScheduleForMonday(siteData, monday),
    };
  });
  const summerNotice = reference.isSummerBreak
    ? `Fermeture estivale : les séances reprennent le ${formatDayLabelFr(reference.resumeIso)}. Le calendrier commence à la semaine de reprise.`
    : undefined;

  const planningDisciplines = siteData.disciplines.map((discipline) => ({
    id: discipline.id,
    name: discipline.name,
    active: discipline.active,
  }));
  const memberCounts = Object.fromEntries(
    siteData.disciplines.map((discipline) => [
      discipline.id,
      countApprovedMemberEmails(clubData, { disciplineId: discipline.id }),
    ]),
  );
  const teacherSuggestions = Array.from(
    new Set(
      [
        ...siteData.schedule.map((slot) => slot.teacherName),
        ...siteData.disciplines.flatMap((discipline) => discipline.teachers),
      ]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "fr"));

  const trialDisciplines = getActiveDisciplineOptions(siteData);
  const allDisciplineOptions = siteData.disciplines.map((discipline) => ({
    id: discipline.id,
    name: discipline.name,
    slug: discipline.slug,
  }));
  const trialRows = buildTrialSlotRows(clubData);

  const coachAbsenceRequests = clubData.coachAbsenceRequests ?? [];
  const pendingAbsences = listPendingCoachAbsences(coachAbsenceRequests);
  const recentAbsences = listRecentCoachAbsences(coachAbsenceRequests);

  return (
    <div className="mx-auto mt-6 w-full max-w-6xl space-y-6 px-4 sm:px-8">
      <BureauPageHeader
        eyebrow="Bureau · Planning"
        title="Planning et essais"
        description={
          access.canApproveCoachAbsences
            ? "Gérez les séances de la semaine, les créneaux d’essai proposés au public et les absences des coachs."
            : "Gérez les séances de la semaine et les créneaux d’essai proposés au public."
        }
      />

      <PlanningTabs
        initialTab={initialTab}
        showAbsences={access.canApproveCoachAbsences}
        pendingAbsences={pendingAbsences.length}
        weekPanel={
          <PlanningWeekView
            weeks={weeks}
            disciplines={planningDisciplines}
            todayIso={todayIso}
            canManageSlots={access.canManageSite}
            memberCounts={memberCounts}
            teacherSuggestions={teacherSuggestions}
            slotCount={siteData.schedule.filter((slot) => slot.active).length}
            summerNotice={summerNotice}
          />
        }
        trialsPanel={
          <TrialSlotsPanel
            disciplines={trialDisciplines}
            allDisciplines={allDisciplineOptions}
            slots={trialRows}
            nowIso={new Date().toISOString()}
          />
        }
        absencesPanel={
          access.canApproveCoachAbsences ? (
            <CoachAbsencePanel
              disciplines={allDisciplineOptions}
              pending={pendingAbsences}
              recent={recentAbsences}
              memberCounts={memberCounts}
            />
          ) : null
        }
      />
    </div>
  );
}
