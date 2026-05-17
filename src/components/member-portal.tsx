"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import type { RegistrationApplication } from "@/lib/club-data";
import {
  getMemberInscriptionLabel,
  getMemberInscriptionStep,
  stepBadgeClass,
} from "@/lib/dossier-workflow";
import type { WeekScheduleEntry } from "@/lib/schedule-week";

import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import type { PendingDocument, UpcomingEvent } from "@/lib/espace-types";

type MemberPortalProps = {
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  applications: RegistrationApplication[];
  membershipStatus: "pending" | "approved" | "rejected";
  hasFullMembership: boolean;
  weekSchedule: WeekScheduleEntry[];
  upcomingEvents: UpcomingEvent[];
  pendingDocument: PendingDocument;
};

const PAYMENT_LABELS: Record<RegistrationApplication["paymentStatus"], string> = {
  unpaid: "Non payé",
  partial: "Partiel",
  paid: "Payé",
};

export default function MemberPortal({
  disciplines,
  slots,
  applications,
  membershipStatus,
  hasFullMembership,
  weekSchedule,
  upcomingEvents,
  pendingDocument,
}: MemberPortalProps) {
  const [disciplineId, setDisciplineId] = useState(disciplines[0]?.id ?? "");
  const [trialSlotId, setTrialSlotId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [motivation, setMotivation] = useState("");
  const [documents, setDocuments] = useState<{ name: string; url: string; uploadedAt: string }[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const disciplineSlots = useMemo(
    () => slots.filter((slot) => slot.disciplineId === disciplineId),
    [disciplineId, slots]
  );

  const latestApplication = applications[0] ?? null;
  const inscriptionStep = latestApplication ? getMemberInscriptionStep(latestApplication) : null;
  const isInscriptionFinalized = inscriptionStep === "finalized" || hasFullMembership;

  const myDisciplineNames = useMemo(() => {
    const ids = new Set(applications.map((a) => a.disciplineId));
    return disciplines.filter((d) => ids.has(d.id)).map((d) => d.name);
  }, [applications, disciplines]);

  const nextSession = useMemo(() => {
    const upcoming = weekSchedule
      .filter((e) => !e.cancelled)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return upcoming[0] ?? null;
  }, [weekSchedule]);

  const cancelledThisWeek = useMemo(
    () => weekSchedule.filter((e) => e.cancelled),
    [weekSchedule]
  );

  const pendingWithoutTrial = applications.filter(
    (application) =>
      !application.trialSlotId &&
      (application.status === "pending" || application.status === "awaiting_document")
  );

  async function uploadDocument(file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/club/documents", { method: "POST", body });
    const payload = (await response.json()) as {
      message?: string;
      name?: string;
      url?: string;
      uploadedAt?: string;
    };
    if (!response.ok || !payload.name || !payload.url || !payload.uploadedAt) {
      throw new Error(payload.message ?? "Upload impossible.");
    }
    return { name: payload.name, url: payload.url, uploadedAt: payload.uploadedAt };
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setMessage("");
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => uploadDocument(file)));
      setDocuments((previous) => [...previous, ...uploaded]);
      setMessage("Documents ajoutés.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur d'upload.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    const response = await fetch("/api/club/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disciplineId,
        trialSlotId: trialSlotId || undefined,
        firstName,
        lastName,
        phone,
        address,
        postalCode,
        city,
        email,
        motivation,
        documents,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Demande envoyée." : "Erreur."));
    setIsLoading(false);
    if (response.ok) {
      window.location.reload();
    }
  }

  async function addTrialRequest(applicationId: string, selectedTrialSlotId: string) {
    if (!selectedTrialSlotId) {
      setMessage("Sélectionnez un créneau d'essai.");
      return;
    }
    const response = await fetch(`/api/club/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trialSlotId: selectedTrialSlotId }),
    });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Créneau d'essai ajouté." : "Erreur."));
    if (response.ok) window.location.reload();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Mon espace</h1>
        <p className="mt-2 text-slate-700">Suivez votre inscription, vos séances et vos demandes.</p>
      </header>

      {latestApplication && inscriptionStep ? (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-6">
          <h2 className="text-xl font-bold text-slate-900">Mon inscription</h2>
          {myDisciplineNames.length > 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              Activité{myDisciplineNames.length > 1 ? "s" : ""} :{" "}
              <span className="font-medium text-slate-800">{myDisciplineNames.join(", ")}</span>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${stepBadgeClass(inscriptionStep)}`}
            >
              {getMemberInscriptionLabel(latestApplication)}
            </span>
            {inscriptionStep === "awaiting_payment" ? (
              <p className="text-sm text-slate-700">
                Paiement : {PAYMENT_LABELS[latestApplication.paymentStatus]}
              </p>
            ) : null}
            {latestApplication.trialAttended ? (
              <p className="text-sm text-slate-600">Essai réalisé</p>
            ) : null}
          </div>
          {!isInscriptionFinalized ? (
            <p className="mt-3 text-sm text-slate-600">
              Les horaires et événements de votre activité seront visibles une fois l&apos;inscription
              finalisée par le bureau.
            </p>
          ) : null}
        </section>
      ) : null}

      {pendingDocument ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-lg font-bold text-rose-900">Pièce manquante</h2>
          <p className="mt-2 text-sm text-rose-800">
            Le bureau vous demande : <strong>{pendingDocument.label}</strong>. Un email vous a été envoyé
            avec un lien sécurisé.
          </p>
          <Link
            href={pendingDocument.uploadUrl}
            className="mt-3 inline-block rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Déposer le document
          </Link>
        </section>
      ) : null}

      {isInscriptionFinalized ? (
        <>
          {cancelledThisWeek.length > 0 ? (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h2 className="text-lg font-bold text-rose-900">Cours annulés cette semaine</h2>
              <ul className="mt-3 space-y-2">
                {cancelledThisWeek.map((entry) => (
                  <li key={entry.id} className="text-sm text-rose-900">
                    <span className="font-semibold">{entry.dayLabel}</span> — {entry.disciplineName},{" "}
                    {entry.startTime}–{entry.endTime}
                    {entry.location ? ` · ${entry.location}` : ""}
                    {entry.cancelReason ? (
                      <span className="mt-0.5 block text-rose-800">Motif : {entry.cancelReason}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {nextSession ? (
            <section className="panel p-6">
              <h2 className="text-xl font-bold text-slate-900">Ma prochaine séance</h2>
              <p className="mt-1 text-xs font-semibold uppercase text-cyan-700">{nextSession.disciplineName}</p>
              <p className="mt-2 text-slate-700">
                <span className="font-semibold">{nextSession.dayLabel}</span>
              </p>
              <p className="text-sm text-slate-600">
                {nextSession.startTime} - {nextSession.endTime} · {nextSession.location}
                {nextSession.teacherName ? ` · ${nextSession.teacherName}` : ""}
              </p>
            </section>
          ) : null}

          {upcomingEvents.length > 0 ? (
            <section className="panel p-6">
              <h2 className="text-xl font-bold text-slate-900">Événements à venir</h2>
              <p className="mt-1 text-sm text-slate-600">Uniquement pour votre/vos activité(s).</p>
              <ul className="mt-4 space-y-4">
                {upcomingEvents.map((event) => (
                  <li key={event.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase text-cyan-700">{event.disciplineName}</p>
                    <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                    <p className="text-sm text-slate-600">
                      {new Date(event.date).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {event.description ? (
                      <p className="mt-2 text-sm text-slate-700">{event.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {weekSchedule.length > 0 ? (
            <section className="panel p-6">
              <h2 className="text-xl font-bold text-slate-900">Horaires de la semaine</h2>
              <p className="mt-1 text-sm text-slate-600">
                Vos activités uniquement — les cours annulés sont signalés en direct.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="py-2 pr-3">Jour</th>
                      <th className="py-2 pr-3">Activité</th>
                      <th className="py-2 pr-3">Horaire</th>
                      <th className="py-2 pr-3">Lieu</th>
                      <th className="py-2 pr-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekSchedule.map((entry) => (
                      <tr
                        key={entry.id}
                        className={
                          entry.cancelled
                            ? "border-b border-rose-100 bg-rose-50/80 text-rose-900"
                            : "border-b border-slate-100"
                        }
                      >
                        <td className="py-2 pr-3 font-medium">{entry.dayLabel}</td>
                        <td className="py-2 pr-3">{entry.disciplineName}</td>
                        <td className={`py-2 pr-3 ${entry.cancelled ? "line-through opacity-80" : ""}`}>
                          {entry.startTime} - {entry.endTime}
                        </td>
                        <td className="py-2 pr-3">{entry.location}</td>
                        <td className="py-2 pr-3">
                          {entry.cancelled ? (
                            <span className="font-semibold text-rose-700">
                              Annulé
                              {entry.cancelReason ? ` — ${entry.cancelReason}` : ""}
                            </span>
                          ) : (
                            <span className="text-emerald-700">Prévu</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <section className="panel p-6">
        <h2 className="text-xl font-bold text-slate-900">Mes demandes</h2>
        <div className="mt-4 space-y-3">
          {applications.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune demande pour le moment.</p>
          ) : (
            applications.map((application) => {
              const step = getMemberInscriptionStep(application);
              return (
                <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">
                    {disciplines.find((d) => d.id === application.disciplineId)?.name ?? "Discipline"}
                  </p>
                  <p className="mt-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${stepBadgeClass(step)}`}
                    >
                      {getMemberInscriptionLabel(application)}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    Essai : {application.trialAttended ? "Réalisé" : "Pas encore réalisé"}
                  </p>
                  {application.notes ? (
                    <p className="mt-2 text-sm text-amber-800">Message du bureau : {application.notes}</p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      <details className="panel p-6">
        <summary className="cursor-pointer text-xl font-bold text-slate-900">
          Déposer une nouvelle pré-inscription
        </summary>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Prénom
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nom
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Téléphone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Adresse
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Code postal
            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ville
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Documents
            <input
              type="file"
              multiple
              onChange={handleFilesChange}
              disabled={isUploading}
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Discipline
            <select
              value={disciplineId}
              onChange={(e) => {
                setDisciplineId(e.target.value);
                setTrialSlotId("");
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            >
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Créneau d&apos;essai (optionnel)
            <select
              value={trialSlotId}
              onChange={(e) => setTrialSlotId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            >
              <option value="">Plus tard</option>
              {disciplineSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {new Date(slot.startsAt).toLocaleString("fr-FR")} — {slot.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Motivation
            <textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              rows={3}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading || isUploading || !disciplineId}
            className="rounded-xl bg-cyan-700 px-5 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            Envoyer ma demande
          </button>
        </form>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </details>

      {pendingWithoutTrial.length > 0 ? (
        <section className="panel p-6">
          <h2 className="text-lg font-bold text-slate-900">Choisir un créneau d&apos;essai</h2>
          <div className="mt-3 space-y-3">
            {pendingWithoutTrial.map((application) => (
              <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-700">
                  Dossier {application.firstName} {application.lastName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slots
                    .filter((slot) => slot.disciplineId === application.disciplineId)
                    .map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => void addTrialRequest(application.id, slot.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                      >
                        {new Date(slot.startsAt).toLocaleDateString("fr-FR")} — {slot.title}
                      </button>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
