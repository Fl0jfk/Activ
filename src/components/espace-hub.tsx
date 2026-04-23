"use client";

import { useState } from "react";
import MemberPortal from "@/components/member-portal";
import ClubAdminPanel from "@/components/club-admin-panel";
import AdminDashboardPage from "@/app/admin/dashboard/page";

type DisciplineOption = { id: string; name: string };
type TrialSlot = { id: string; disciplineId: string; title: string; startsAt: string; capacity: number };
type Application = {
  id: string;
  requestKind: "trial_and_preregistration" | "trial_only";
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  documents: { name: string; url: string; uploadedAt: string }[];
  disciplineId: string;
  trialSlotId: string | null;
  motivation: string;
  createdAt: string;
  status: "pending" | "awaiting_document" | "approved" | "rejected";
  trialAttended: boolean;
  paymentStatus: "unpaid" | "partial" | "paid";
  paymentMethod: "cash" | "check" | "bank_transfer" | "card" | "other" | "";
  licenseEndDate: string | null;
  notes: string;
  fullName?: string;
};

type EspaceHubProps = {
  canAccessAdmin: boolean;
  disciplines: DisciplineOption[];
  slots: TrialSlot[];
  myApplications: Application[];
  allApplications: Application[];
};

export default function EspaceHub({
  canAccessAdmin,
  disciplines,
  slots,
  myApplications,
  allApplications,
}: EspaceHubProps) {
  const pendingCount = allApplications.filter(
    (application) => application.status === "pending" || application.status === "awaiting_document",
  ).length;
  const [activeTab, setActiveTab] = useState<"member" | "admin-site" | "preregistrations" | "cockpit">("member");

  const countsByDiscipline = disciplines
    .map((discipline) => ({
      id: discipline.id,
      name: discipline.name,
      count: allApplications.filter((application) => application.disciplineId === discipline.id).length,
      paidCount: allApplications.filter(
        (application) => application.disciplineId === discipline.id && application.paymentStatus === "paid",
      ).length,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(1, ...countsByDiscipline.map((item) => item.count));
  const paidCount = allApplications.filter((application) => application.paymentStatus === "paid").length;
  const awaitingDocCount = allApplications.filter((application) => application.status === "awaiting_document").length;
  const approvedCount = allApplications.filter((application) => application.status === "approved").length;
  const toProcess = allApplications.filter(
    (application) => application.status === "pending" || application.status === "awaiting_document",
  );
  const upcomingTrialSlots = [...slots]
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 6);

  return (
    <main className="pb-8">
      <section className="mx-auto mt-4 flex w-full max-w-6xl flex-wrap gap-2 px-4 sm:px-8">
        <button
          type="button"
          onClick={() => setActiveTab("member")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "member" ? "bg-cyan-700 text-white" : "bg-white text-slate-800"}`}
        >
          Mon espace
        </button>
        {canAccessAdmin ? (
          <>
            <button
              type="button"
              onClick={() => setActiveTab("admin-site")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "admin-site" ? "bg-cyan-700 text-white" : "bg-white text-slate-800"}`}
            >
              Administration du site
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preregistrations")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "preregistrations" ? "bg-cyan-700 text-white" : "bg-white text-slate-800"}`}
            >
              Pre-inscriptions ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cockpit")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "cockpit" ? "bg-cyan-700 text-white" : "bg-white text-slate-800"}`}
            >
              Cockpit bureau
            </button>
          </>
        ) : null}
      </section>

      {activeTab === "member" ? (
        <section>
          <MemberPortal disciplines={disciplines} slots={slots} applications={myApplications} />
        </section>
      ) : null}

      {canAccessAdmin && activeTab === "admin-site" ? (
        <>
          <section className="mt-8">
            <AdminDashboardPage />
          </section>
        </>
      ) : null}

      {canAccessAdmin && activeTab === "preregistrations" ? (
        <section className="mt-8">
          <div className="mx-auto mb-3 w-full max-w-6xl px-4 sm:px-8">
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              President / Secretary - {pendingCount} demande(s) en attente
            </p>
          </div>
          <ClubAdminPanel disciplines={disciplines} applications={allApplications} />
        </section>
      ) : null}

      {canAccessAdmin && activeTab === "cockpit" ? (
        <section className="mx-auto mt-8 w-full max-w-6xl px-4 sm:px-8">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Tableau bureau</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-4">Dossiers a traiter</th>
                    <th className="py-2 pr-4">Docs manquants</th>
                    <th className="py-2 pr-4">Paiements valides</th>
                    <th className="py-2 pr-4">Inscriptions validees</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-slate-900">
                    <td className="py-3 pr-4 text-xl font-bold">{pendingCount}</td>
                    <td className="py-3 pr-4 text-xl font-bold">{awaitingDocCount}</td>
                    <td className="py-3 pr-4 text-xl font-bold">{paidCount}</td>
                    <td className="py-3 pr-4 text-xl font-bold">{approvedCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-xl font-bold text-slate-900">Bar chart discipline (demandes vs membres reels)</h2>
              <p className="mt-1 text-sm text-slate-600">
                Bleu: demandes totales, Vert: membres valides/payes, Violet: creneaux d&apos;essai.
              </p>
              <div className="mt-4 space-y-4">
                {countsByDiscipline.map((item) => {
                  const approvedPaidCount = allApplications.filter(
                    (application) =>
                      application.disciplineId === item.id &&
                      application.status === "approved" &&
                      application.paymentStatus === "paid",
                  ).length;
                  const trialSlotCount = slots.filter((slot) => slot.disciplineId === item.id).length;
                  const widthTotal = `${Math.max(8, Math.round((item.count / maxCount) * 100))}%`;
                  const widthApproved = `${item.count > 0 ? Math.round((approvedPaidCount / item.count) * 100) : 0}%`;
                  const widthTrials = `${Math.min(100, trialSlotCount * 10)}%`;

                  return (
                    <div key={item.id}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800">{item.name}</span>
                        <span className="text-slate-600">
                          {item.count} demandes / {approvedPaidCount} membres reels / {trialSlotCount} creneaux
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-full rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-cyan-500" style={{ width: widthTotal }} />
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: widthApproved }} />
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: widthTrials }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Dossiers a traiter (detail)</h2>
              <p className="mt-1 text-sm text-slate-600">Vue rapide des prochaines actions.</p>
              <div className="mt-4 space-y-3">
                {toProcess.length > 0 ? (
                  toProcess.slice(0, 6).map((application) => {
                    const disciplineName =
                      disciplines.find((discipline) => discipline.id === application.disciplineId)?.name ?? "Discipline";
                    return (
                      <div key={application.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase text-cyan-700">{disciplineName}</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {application.firstName} {application.lastName}
                        </p>
                        <p className="text-sm text-slate-700">{application.email}</p>
                        <p className="text-xs text-slate-600">
                          {application.status} - pieces: {application.documents.length} - paiement: {application.paymentStatus}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-600">Aucun dossier urgent.</p>
                )}
              </div>
            </article>
          </div>

          <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Prochains essais planifies</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-4">Discipline</th>
                    <th className="py-2 pr-4">Titre</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingTrialSlots.map((slot) => {
                    const disciplineName =
                      disciplines.find((discipline) => discipline.id === slot.disciplineId)?.name ?? "Discipline";
                    return (
                      <tr key={slot.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4">{disciplineName}</td>
                        <td className="py-2 pr-4">{slot.title}</td>
                        <td className="py-2 pr-4">{new Date(slot.startsAt).toLocaleString("fr-FR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
