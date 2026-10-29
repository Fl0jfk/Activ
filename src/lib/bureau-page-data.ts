import { cache } from "react";
import { redirect } from "next/navigation";
import {
  canAccessClubOperations,
  canApproveCoachAbsences,
  canManageSiteData,
  getCurrentUserContext,
} from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { listApplicationsNeedingLicenseRenewal } from "@/lib/license-renewal";
import { readSiteData } from "@/lib/site-data";
import type {
  MemberContactChangeRequest,
  RegistrationApplication,
} from "@/lib/club-data";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";

export type BureauPageAccess = {
  canManageSite: boolean;
  canApproveCoachAbsences: boolean;
};

/** Garde d’accès commune aux pages outils du bureau. */
export const requireBureauPageAccess = cache(async (): Promise<BureauPageAccess> => {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    redirect("/sign-in?redirect_url=/espace");
  }
  if (!canAccessClubOperations(currentUser)) {
    redirect("/espace");
  }

  return {
    canManageSite: canManageSiteData(currentUser),
    canApproveCoachAbsences: canApproveCoachAbsences(currentUser),
  };
});

export type BureauPageData = BureauPageAccess & {
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  applications: RegistrationApplication[];
  contactChangeRequests: MemberContactChangeRequest[];
  coachAbsencePendingCount: number;
  memberRequestPendingCount: number;
  renewalCount: number;
};

/** Données partagées par les pages outils (disciplines, créneaux, dossiers). */
export async function loadBureauPageData(): Promise<BureauPageData> {
  const access = await requireBureauPageAccess();
  const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);

  return {
    ...access,
    disciplines: getActiveDisciplineOptions(siteData),
    slots: clubData.trialSlots.filter((slot) => slot.active),
    applications: clubData.applications,
    contactChangeRequests: (clubData.contactChangeRequests ?? []).filter(
      (request) => request.status === "pending",
    ),
    coachAbsencePendingCount: (clubData.coachAbsenceRequests ?? []).filter(
      (request) => request.status === "pending",
    ).length,
    memberRequestPendingCount: (clubData.memberRequests ?? []).filter(
      (request) => request.status === "received" || request.status === "in_progress",
    ).length,
    renewalCount: listApplicationsNeedingLicenseRenewal(clubData.applications).length,
  };
}
