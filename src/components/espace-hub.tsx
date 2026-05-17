"use client";

import { useMemo, useState } from "react";
import BureauCockpit from "@/components/bureau-cockpit";
import CoachPortal from "@/components/coach-portal";
import MemberPortal from "@/components/member-portal";
import type { RegistrationApplication } from "@/lib/club-data";
import { isDossierEnCours } from "@/lib/dossier-workflow";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

type DisciplineOption = { id: string; name: string };
type TrialSlot = { id: string; disciplineId: string; title: string; startsAt: string; capacity: number };

type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  description: string;
  disciplineName: string;
};

type PendingDocument = {
  applicationId: string;
  label: string;
  uploadUrl: string;
} | null;

type EspaceTab = "member" | "cockpit" | "coach";

type EspaceHubProps = {
  canAccessClubOperations: boolean;
  canManageSite: boolean;
  canAccessCoachPortal: boolean;
  canApproveCoachAbsences: boolean;
  coachAbsencePendingCount: number;
  membershipStatus: "pending" | "approved" | "rejected";
  hasFullMembership: boolean;
  disciplines: DisciplineOption[];
  slots: TrialSlot[];
  myApplications: RegistrationApplication[];
  allApplications: RegistrationApplication[];
  weekSchedule: WeekScheduleEntry[];
  upcomingEvents: UpcomingEvent[];
  pendingDocument: PendingDocument;
  defaultTab?: EspaceTab;
};

export default function EspaceHub({
  canAccessClubOperations,
  canManageSite,
  canAccessCoachPortal,
  canApproveCoachAbsences,
  coachAbsencePendingCount,
  membershipStatus,
  hasFullMembership,
  disciplines,
  slots,
  myApplications,
  allApplications,
  weekSchedule,
  upcomingEvents,
  pendingDocument,
  defaultTab,
}: EspaceHubProps) {
  const resolvedDefault: EspaceTab =
    defaultTab ??
    (canAccessClubOperations ? "cockpit" : canAccessCoachPortal ? "coach" : "member");

  const [activeTab, setActiveTab] = useState<EspaceTab>(resolvedDefault);

  const pendingCount = useMemo(
    () => allApplications.filter(isDossierEnCours).length,
    [allApplications]
  );

  return (
    <main className="pb-8">
      <section className="mx-auto mt-4 flex w-full max-w-6xl flex-wrap gap-2 px-4 sm:px-8">
        <button
          type="button"
          onClick={() => setActiveTab("member")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            activeTab === "member" ? "bg-cyan-700 text-white" : "bg-white text-slate-800"
          }`}
        >
          Mon espace
        </button>
        {canAccessClubOperations ? (
          <button
            type="button"
            onClick={() => setActiveTab("cockpit")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === "cockpit" ? "bg-cyan-700 text-white" : "bg-white text-slate-800"
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
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === "coach" ? "bg-cyan-700 text-white" : "bg-white text-slate-800"
            }`}
          >
            Espace coach
          </button>
        ) : null}
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
          disciplines={disciplines}
          slots={slots}
          applications={allApplications}
          weekSchedule={weekSchedule}
        />
      ) : null}

      {canAccessCoachPortal && activeTab === "coach" ? <CoachPortal /> : null}
    </main>
  );
}
