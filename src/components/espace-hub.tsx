"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BureauCockpit from "@/components/bureau-cockpit";
import CoachPortal from "@/components/coach-portal";
import MemberPortal from "@/components/member-portal";
import type { RegistrationApplication, MemberContactChangeRequest } from "@/lib/club-data";
import { isDossierEnCours } from "@/lib/dossier-workflow";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import type { PendingDocument, UpcomingEvent } from "@/lib/espace-types";
import type { WeekScheduleEntry } from "@/lib/schedule-week";
import type { PlannerDiscipline, PlannerWeek } from "@/components/week-planner";

type EspaceTab = "member" | "cockpit" | "coach";

type EspaceHubProps = {
  canAccessClubOperations: boolean;
  canManageSite: boolean;
  canAccessCoachPortal: boolean;
  canApproveCoachAbsences: boolean;
  coachAbsencePendingCount: number;
  memberRequestPendingCount: number;
  contactChangePendingCount: number;
  renewalCount: number;
  newsCount: number;
  galleryCount: number;
  membershipStatus: "pending" | "approved" | "rejected";
  hasFullMembership: boolean;
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  myApplications: RegistrationApplication[];
  allApplications: RegistrationApplication[];
  weekSchedule: WeekScheduleEntry[];
  plannerWeeks: PlannerWeek[];
  plannerDisciplines: PlannerDiscipline[];
  nextSession: WeekScheduleEntry | null;
  todayIso: string;
  bureauWeekSchedule: WeekScheduleEntry[];
  upcomingEvents: UpcomingEvent[];
  pendingDocument: PendingDocument;
  contactChangeRequest?: MemberContactChangeRequest | null;
  defaultTab?: EspaceTab;
};

function initialTab(
  canAccessClubOperations: boolean,
  canAccessCoachPortal: boolean,
  defaultTab?: EspaceTab,
): EspaceTab {
  return (
    defaultTab ??
    (canAccessClubOperations ? "cockpit" : canAccessCoachPortal ? "coach" : "member")
  );
}

export default function EspaceHub({
  canAccessClubOperations,
  canManageSite,
  canAccessCoachPortal,
  canApproveCoachAbsences,
  coachAbsencePendingCount,
  memberRequestPendingCount,
  contactChangePendingCount,
  renewalCount,
  newsCount,
  galleryCount,
  membershipStatus,
  hasFullMembership,
  disciplines,
  slots,
  myApplications,
  allApplications,
  weekSchedule,
  plannerWeeks,
  plannerDisciplines,
  nextSession,
  todayIso,
  bureauWeekSchedule,
  upcomingEvents,
  pendingDocument,
  contactChangeRequest,
  defaultTab,
}: EspaceHubProps) {
  const [activeTab, setActiveTab] = useState<EspaceTab>(() =>
    initialTab(canAccessClubOperations, canAccessCoachPortal, defaultTab),
  );
  const router = useRouter();

  const pendingCount = useMemo(
    () => allApplications.filter(isDossierEnCours).length + memberRequestPendingCount,
    [allApplications, memberRequestPendingCount],
  );

  useEffect(() => {
    if (window.location.hash !== "#dossiers" || !canAccessClubOperations) return;
    router.replace("/espace/bureau/dossiers");
  }, [canAccessClubOperations, router]);

  return (
    <main className="min-w-0 overflow-x-hidden pb-8">
      <section className="mx-auto mt-4 flex w-full max-w-6xl flex-wrap gap-2 px-4 sm:px-8">
        <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-brand-line bg-white p-1 shadow-[0_10px_30px_-24px_rgba(20,64,127,0.5)]">
          <button
            type="button"
            onClick={() => setActiveTab("member")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "member"
                ? "bg-brand-blue text-white shadow-sm"
                : "text-slate-600 hover:bg-brand-cream hover:text-slate-900"
            }`}
          >
            Mon espace
          </button>
          {canAccessClubOperations ? (
            <button
              type="button"
              onClick={() => setActiveTab("cockpit")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "cockpit"
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-slate-600 hover:bg-brand-cream hover:text-slate-900"
              }`}
            >
              Cockpit bureau
              {pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ) : null}
          {canAccessCoachPortal ? (
            <button
              type="button"
              onClick={() => setActiveTab("coach")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === "coach"
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-slate-600 hover:bg-brand-cream hover:text-slate-900"
              }`}
            >
              Espace coach
            </button>
          ) : null}
        </div>
      </section>

      {activeTab === "member" ? (
        <MemberPortal
          disciplines={disciplines}
          slots={slots}
          applications={myApplications}
          membershipStatus={membershipStatus}
          hasFullMembership={hasFullMembership}
          weekSchedule={weekSchedule}
          plannerWeeks={plannerWeeks}
          plannerDisciplines={plannerDisciplines}
          nextSession={nextSession}
          todayIso={todayIso}
          upcomingEvents={upcomingEvents}
          pendingDocument={pendingDocument}
          contactChangeRequest={contactChangeRequest}
        />
      ) : null}

      {canAccessClubOperations && activeTab === "cockpit" ? (
        <BureauCockpit
          canManageSite={canManageSite}
          canApproveCoachAbsences={canApproveCoachAbsences}
          coachAbsencePendingCount={coachAbsencePendingCount}
          memberRequestPendingCount={memberRequestPendingCount}
          contactChangePendingCount={contactChangePendingCount}
          renewalCount={renewalCount}
          newsCount={newsCount}
          galleryCount={galleryCount}
          disciplines={disciplines}
          slots={slots}
          applications={allApplications}
          weekSchedule={bureauWeekSchedule}
        />
      ) : null}

      {canAccessCoachPortal && activeTab === "coach" ? <CoachPortal /> : null}
    </main>
  );
}
