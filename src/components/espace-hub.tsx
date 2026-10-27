"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BureauCockpit from "@/components/bureau-cockpit";
import CoachPortal from "@/components/coach-portal";
import MemberPortal from "@/components/member-portal";
import type { RegistrationApplication } from "@/lib/club-data";
import { isDossierEnCours } from "@/lib/dossier-workflow";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import type { PendingDocument, UpcomingEvent } from "@/lib/espace-types";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

type EspaceTab = "member" | "cockpit" | "coach";

type EspaceHubProps = {
  canAccessClubOperations: boolean;
  canManageSite: boolean;
  canAccessCoachPortal: boolean;
  canApproveCoachAbsences: boolean;
  coachAbsencePendingCount: number;
  memberRequestPendingCount: number;
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
  bureauWeekSchedule: WeekScheduleEntry[];
  upcomingEvents: UpcomingEvent[];
  pendingDocument: PendingDocument;
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
  bureauWeekSchedule,
  upcomingEvents,
  pendingDocument,
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
        <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveTab("member")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeTab === "member"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-white hover:text-slate-900"
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
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
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
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
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
          upcomingEvents={upcomingEvents}
          pendingDocument={pendingDocument}
        />
      ) : null}

      {canAccessClubOperations && activeTab === "cockpit" ? (
        <BureauCockpit
          canManageSite={canManageSite}
          canApproveCoachAbsences={canApproveCoachAbsences}
          coachAbsencePendingCount={coachAbsencePendingCount}
          memberRequestPendingCount={memberRequestPendingCount}
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
