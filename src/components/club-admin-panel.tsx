"use client";

import { FormEvent, useState } from "react";
import type { RegistrationApplication } from "@/lib/club-data";

type Discipline = { id: string; name: string };

type ClubAdminPanelProps = {
  disciplines: Discipline[];
  applications: RegistrationApplication[];
};

export default function ClubAdminPanel({ disciplines, applications }: ClubAdminPanelProps) {
  const [slotDisciplineId, setSlotDisciplineId] = useState(disciplines[0]?.id ?? "");
  const [slotTitle, setSlotTitle] = useState("");
  const [slotStartsAt, setSlotStartsAt] = useState("");
  const [slotCapacity, setSlotCapacity] = useState(12);
  const [message, setMessage] = useState("");
  const pendingCount = applications.filter((application) => application.status === "pending" || application.status === "awaiting_document").length;
  const pendingApplications = applications.filter((application) => application.status === "pending" || application.status === "awaiting_document");
  const registeredCount = applications.filter(
    (application) => application.status === "approved" && application.trialAttended && application.paymentStatus === "paid",
  ).length;
  const unpaidCount = applications.filter((application) => application.paymentStatus === "unpaid").length;

  async function createTrialSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/club/trial-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disciplineId: slotDisciplineId,
        title: slotTitle,
        startsAt: slotStartsAt,
        capacity: slotCapacity,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Creneau cree." : "Erreur."));
    if (response.ok) {
      setSlotTitle("");
      setSlotStartsAt("");
      window.location.reload();
    }
  }

  async function updateApplication(
    applicationId: string,
    payload: {
      status?: "pending" | "awaiting_document" | "approved" | "rejected";
      trialAttended?: boolean;
      paymentStatus?: "unpaid" | "partial" | "paid";
      paymentMethod?: "cash" | "check" | "bank_transfer" | "card" | "other" | "";
      notes?: string;
      licenseEndDate?: string | null;
    },
  ) {
    const response = await fetch(`/api/club/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      window.location.reload();
    } else {
      const body = (await response.json()) as { message?: string };
      setMessage(body.message ?? "Erreur de mise a jour.");
    }
  }

  async function requestMissingDocument(applicationId: string) {
    const label = window.prompt("Quelle piece demander ? (ex: certificat medical)", "certificat medical");
    if (!label) {
      return;
    }
    const response = await fetch(`/api/club/applications/${applicationId}/request-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentLabel: label }),
    });
    const body = (await response.json()) as { message?: string; secureLink?: string };
    if (response.ok) {
      setMessage(
        `${body.message ?? "Demande envoyee."} ${body.secureLink ? `Lien de secours: ${body.secureLink}` : ""}`.trim(),
      );
    } else {
      setMessage(body.message ?? "Impossible d'envoyer la demande de document.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-bold text-slate-900">Interface president / secretaire</h1>
      <p className="mt-2 text-slate-700">Cree des seances d&apos;essai puis valide les demandes, paiements et fonctions.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase text-amber-700">Demandes en attente</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold uppercase text-emerald-700">Inscriptions finalisees</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">{registeredCount}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold uppercase text-rose-700">Paiements en attente</p>
          <p className="mt-1 text-2xl font-bold text-rose-800">{unpaidCount}</p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Liste d&apos;attente (a traiter)</h2>
        <div className="mt-4 space-y-3">
          {pendingApplications.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune demande en attente.</p>
          ) : (
            pendingApplications.map((application) => (
              <article key={`pending-${application.id}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {application.fullName} - {application.email}
                </p>
                <p className="text-sm text-slate-700">{application.phone}</p>
                <p className="text-sm text-slate-700">{application.address}</p>
                <p className="text-sm text-slate-700">{application.postalCode} {application.city}</p>
                {application.motivation ? <p className="mt-1 text-sm text-slate-700">{application.motivation}</p> : null}
                <p className="text-sm text-slate-700">
                  Pieces jointes: <span className="font-semibold">{application.documents.length}</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void updateApplication(application.id, { status: "approved" })}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateApplication(application.id, { status: "rejected" })}
                    className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Refuser
                  </button>
                  <button
                    type="button"
                    onClick={() => void requestMissingDocument(application.id)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800"
                  >
                    Demander une piece
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Creer un creneau d&apos;essai</h2>
        <p className="mt-1 text-sm text-slate-600">
          Les dates d&apos;essai configurees ici sont celles proposees dans le formulaire de pre-inscription.
        </p>
        <form onSubmit={createTrialSlot} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Discipline
            <select
              value={slotDisciplineId}
              onChange={(event) => setSlotDisciplineId(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            >
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Intitule
            <input
              value={slotTitle}
              onChange={(event) => setSlotTitle(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              placeholder="Essai yoga debutants"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Date et heure
            <input
              type="datetime-local"
              value={slotStartsAt}
              onChange={(event) => setSlotStartsAt(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Capacite
            <input
              type="number"
              min={1}
              value={slotCapacity}
              onChange={(event) => setSlotCapacity(Number(event.target.value))}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <button type="submit" className="rounded-xl bg-cyan-700 px-5 py-3 font-semibold text-white sm:col-span-2">
            Ajouter le creneau
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Demandes de pre-inscription</h2>
        <div className="mt-4 space-y-3">
          {applications.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune demande actuellement.</p>
          ) : (
            applications.map((application) => (
              <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-base font-semibold text-slate-900">{application.fullName}</h3>
                <p className="text-sm text-slate-700">
                  {application.email} - {disciplines.find((entry) => entry.id === application.disciplineId)?.name ?? "Discipline"}
                </p>
                <p className="text-sm text-slate-700">{application.phone} - {application.address}</p>
                <p className="text-sm text-slate-700">{application.postalCode} {application.city}</p>
                <p className="text-sm text-slate-700">
                  Statut dossier: <span className="font-semibold">{application.status}</span>
                </p>
                <p className="text-sm text-slate-700">
                  Mode de paiement: <span className="font-semibold">{application.paymentMethod || "non defini"}</span>
                </p>
                {application.motivation ? <p className="mt-1 text-sm text-slate-700">{application.motivation}</p> : null}
                {application.documents.length > 0 ? (
                  <div className="mt-1 text-sm text-slate-700">
                    Documents:
                    <ul className="mt-1 space-y-1">
                      {application.documents.map((doc) => (
                        <li key={`${doc.url}-${doc.uploadedAt}`}>- {doc.name} ({doc.url})</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select
                    defaultValue={application.status}
                    onChange={(event) =>
                      void updateApplication(application.id, {
                        status: event.target.value as "pending" | "awaiting_document" | "approved" | "rejected",
                      })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="pending">En attente</option>
                    <option value="awaiting_document">En attente de piece</option>
                    <option value="approved">Validee</option>
                    <option value="rejected">Refusee</option>
                  </select>

                  <select
                    defaultValue={application.paymentStatus}
                    onChange={(event) =>
                      void updateApplication(application.id, {
                        paymentStatus: event.target.value as "unpaid" | "partial" | "paid",
                      })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="unpaid">Paiement non regle</option>
                    <option value="partial">Paiement partiel</option>
                    <option value="paid">Paiement regle</option>
                  </select>
                  <select
                    defaultValue={application.paymentMethod}
                    onChange={(event) =>
                      void updateApplication(application.id, {
                        paymentMethod: event.target.value as "cash" | "check" | "bank_transfer" | "card" | "other" | "",
                      })
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Mode de paiement</option>
                    <option value="cash">Especes</option>
                    <option value="check">Cheque</option>
                    <option value="bank_transfer">Virement</option>
                    <option value="card">Carte</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
                <div className="mt-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                    Fin de licence
                    <input
                      type="date"
                      defaultValue={application.licenseEndDate ?? ""}
                      onChange={(event) =>
                        void updateApplication(application.id, {
                          licenseEndDate: event.target.value || null,
                        })
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                    />
                  </label>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void updateApplication(application.id, { trialAttended: !application.trialAttended })}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold"
                  >
                    Essai realise: {application.trialAttended ? "Oui" : "Non"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void requestMissingDocument(application.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                  >
                    Demander piece manquante
                  </button>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() =>
                      void updateApplication(application.id, {
                        status: "approved",
                        trialAttended: true,
                        paymentStatus: "paid",
                      })
                    }
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Inscrire definitivement (essai valide + paiement recu)
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {message ? <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{message}</p> : null}
    </main>
  );
}
