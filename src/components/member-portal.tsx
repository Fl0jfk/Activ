"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import AccountSettings from "@/components/account-settings";
import MemberContactSection from "@/components/member-contact-section";
import MemberRequestsSection from "@/components/member-requests-section";
import PaymentReceiptLink from "@/components/payment-receipt-link";
import SiteImage from "@/components/site-image";
import WeekPlanner, { type PlannerDiscipline, type PlannerWeek } from "@/components/week-planner";
import type { MemberContactChangeRequest, RegistrationApplication } from "@/lib/club-data";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import {
  type DossierStep,
  getDossierProcessingPhase,
  getMemberInscriptionLabel,
  getMemberInscriptionStep,
  stepBadgeClass,
} from "@/lib/dossier-workflow";
import type { PendingDocument, UpcomingEvent } from "@/lib/espace-types";
import { formatHourLabel } from "@/lib/public-site";
import type { WeekScheduleEntry } from "@/lib/schedule-week";
import { FALLBACK_DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import { formatEventSchedule, newsKindLabel, truncateNewsDescription } from "@/lib/site-news";

type MemberPortalProps = {
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  applications: RegistrationApplication[];
  membershipStatus: "pending" | "approved" | "rejected";
  hasFullMembership: boolean;
  weekSchedule: WeekScheduleEntry[];
  plannerWeeks: PlannerWeek[];
  plannerDisciplines: PlannerDiscipline[];
  nextSession: WeekScheduleEntry | null;
  todayIso: string;
  upcomingEvents: UpcomingEvent[];
  pendingDocument: PendingDocument;
  contactChangeRequest?: MemberContactChangeRequest | null;
};

const PAYMENT_LABELS: Record<RegistrationApplication["paymentStatus"], string> = {
  unpaid: "Non payé",
  partial: "Partiel",
  paid: "Payé",
};

const STEPS = ["Demande reçue", "Accès validé", "Pièces", "Paiement", "Inscription finalisée"];

const STEP_MESSAGES: Record<DossierStep, string> = {
  new_request: "Le bureau examine votre demande. Vous serez prévenu(e) par e-mail dès qu'elle avance.",
  awaiting_espace: "Le bureau finalise l'ouverture de votre espace. Vous serez prévenu(e) par e-mail.",
  missing_document: "Une pièce est à fournir pour poursuivre votre inscription (voir l'encadré ci-dessous).",
  awaiting_payment: "Vos pièces sont conformes. Il reste à régler votre cotisation auprès du bureau.",
  finalized: "Bienvenue ! Votre inscription est finalisée, vous retrouvez ci-dessous vos séances et vos événements.",
  rejected: "Votre dossier n'a pas pu être accepté. Contactez le bureau pour en savoir plus.",
  cancelled: "Vous êtes désinscrit(e). Contactez le bureau si vous souhaitez reprendre une activité.",
};

function timeRange(entry: Pick<WeekScheduleEntry, "startTime" | "endTime">): string {
  const start = entry.startTime ? formatHourLabel(entry.startTime) : "";
  const end = entry.endTime ? formatHourLabel(entry.endTime) : "";
  if (start && end) return `${start} – ${end}`;
  return start || end || "Horaire à préciser";
}

function InscriptionStepper({ phase }: { phase: number }) {
  return (
    <ol className="mt-5 grid grid-cols-5" aria-label="Avancement de l'inscription">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const done = number < phase || phase === 5;
        const current = number === phase && phase !== 5;
        return (
          <li key={label} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={`absolute left-1/2 top-4 h-0.5 w-full ${number < phase ? "bg-brand-green" : "bg-slate-200"}`}
              />
            ) : null}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                done
                  ? "bg-brand-green text-white"
                  : current
                    ? "bg-brand-blue text-white ring-4 ring-brand-blue/20"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? "✓" : number}
            </span>
            <span
              className={`mt-2 px-0.5 text-[11px] font-semibold leading-tight sm:text-[13px] ${
                current ? "text-brand-blue" : done ? "text-slate-700" : "text-slate-400"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function EventCard({ event }: { event: UpcomingEvent }) {
  const schedule = formatEventSchedule(event);
  return (
    <li>
      <Link
        href={`/actualites/${event.id}`}
        className="group grid h-full grid-cols-[110px_1fr] overflow-hidden rounded-2xl border border-brand-line bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-26px_rgba(20,64,127,0.5)] sm:grid-cols-[140px_1fr]"
      >
        <div className="relative min-h-[170px] bg-brand-blue/5">
          {event.imageUrl ? (
            <SiteImage
              src={event.imageUrl}
              alt=""
              fill
              sizes="140px"
              className="object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-4xl text-brand-blue/30" aria-hidden>
              ★
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 p-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-brand-green-dark">
            {event.disciplineName !== "Association" ? event.disciplineName : newsKindLabel(event.kind)}
          </p>
          <h3 className="text-base font-extrabold leading-snug text-slate-900">{event.title}</h3>
          {schedule ? <p className="text-sm font-semibold text-slate-700">{schedule}</p> : null}
          {event.location ? <p className="text-sm text-slate-600">{event.location}</p> : null}
          {event.description ? (
            <p className="text-break line-clamp-3 text-sm text-slate-600">
              {truncateNewsDescription(event.description, 180)}
            </p>
          ) : null}
          <span className="mt-auto pt-1 text-sm font-bold text-brand-blue group-hover:underline">Voir le détail →</span>
        </div>
      </Link>
    </li>
  );
}

export default function MemberPortal({
  disciplines,
  slots,
  applications,
  membershipStatus,
  hasFullMembership,
  weekSchedule,
  plannerWeeks,
  plannerDisciplines,
  nextSession,
  todayIso,
  upcomingEvents,
  pendingDocument,
  contactChangeRequest = null,
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
  const contactApplication =
    applications.find(
      (application) =>
        application.status !== "rejected" && application.status !== "cancelled",
    ) ?? null;
  const isInscriptionFinalized = inscriptionStep === "finalized" || hasFullMembership;
  const greetingName = (contactApplication ?? latestApplication)?.firstName?.trim();

  const colorById = useMemo(
    () => new Map(plannerDisciplines.map((item) => [item.id, item.color])),
    [plannerDisciplines],
  );
  const slugById = useMemo(() => new Map(disciplines.map((item) => [item.id, item.slug])), [disciplines]);

  const myDisciplines = useMemo(() => {
    const ids = new Set(
      applications.flatMap((application) =>
        application.disciplineIds?.length
          ? application.disciplineIds
          : application.disciplineId
            ? [application.disciplineId]
            : [],
      ),
    );
    return disciplines.filter((d) => ids.has(d.id));
  }, [applications, disciplines]);

  const cancelledThisWeek = useMemo(
    () => weekSchedule.filter((e) => e.cancelled),
    [weekSchedule]
  );

  const pendingWithoutTrial = applications.filter(
    (application) =>
      !application.trialSlotId &&
      (application.status === "pending" || application.status === "awaiting_document")
  );

  const navLinks = [
    isInscriptionFinalized && plannerWeeks.some((week) => week.entries.length > 0)
      ? { href: "#mon-planning", label: "Mon planning" }
      : null,
    isInscriptionFinalized && upcomingEvents.length > 0 ? { href: "#evenements", label: "Événements" } : null,
    contactApplication ? { href: "#mes-coordonnees", label: "Mes coordonnées" } : null,
    { href: "#demandes", label: "Demandes au bureau" },
    { href: "#mes-dossiers", label: "Mes dossiers" },
    { href: "#mon-compte", label: "Mon compte" },
  ].filter((item): item is { href: string; label: string } => item !== null);

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

  const nextColor = nextSession ? (colorById.get(nextSession.disciplineId) ?? FALLBACK_DISCIPLINE_COLOR) : null;
  const nextSlug = nextSession ? slugById.get(nextSession.disciplineId) : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <header>
        <span className="eyebrow">Mon espace</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          {greetingName ? `Bonjour ${greetingName}` : "Bonjour"}
        </h1>
        <p className="mt-2 text-slate-600">Suivez votre inscription, vos séances et vos demandes.</p>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Aller à">
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-brand-blue hover:text-brand-blue"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      {pendingDocument ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-extrabold text-rose-900">Pièce manquante</h2>
            <p className="mt-1 text-sm text-rose-800">
              Le bureau vous demande : <strong>{pendingDocument.label}</strong>. Un e-mail vous a été envoyé avec un
              lien sécurisé.
            </p>
          </div>
          <Link
            href={pendingDocument.uploadUrl}
            className="btn btn-sm bg-rose-600 text-white hover:bg-rose-700"
          >
            Déposer le document
          </Link>
        </section>
      ) : null}

      {isInscriptionFinalized && cancelledThisWeek.length > 0 ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-rose-900">Cours annulés cette semaine</h2>
          <ul className="mt-3 space-y-2">
            {cancelledThisWeek.map((entry) => (
              <li key={entry.id} className="text-sm text-rose-900">
                <span className="font-bold">{entry.dayLabel}</span> · {entry.disciplineName}, {timeRange(entry)}
                {entry.location ? ` · ${entry.location}` : ""}
                {entry.cancelReason ? (
                  <span className="mt-0.5 block text-rose-800">Motif : {entry.cancelReason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {latestApplication && inscriptionStep ? (
        <section className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Mon inscription</h2>
              {myDisciplines.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {myDisciplines.map((discipline) => {
                    const color = colorById.get(discipline.id) ?? FALLBACK_DISCIPLINE_COLOR;
                    return (
                      <Link
                        key={discipline.id}
                        href={`/disciplines/${discipline.slug}`}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold text-slate-900 transition hover:brightness-95"
                        style={{ backgroundColor: color.soft }}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.bg }} aria-hidden />
                        {discipline.name}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${stepBadgeClass(inscriptionStep)}`}
            >
              {getMemberInscriptionLabel(latestApplication)}
            </span>
          </div>

          {inscriptionStep !== "rejected" && inscriptionStep !== "cancelled" ? (
            <InscriptionStepper phase={getDossierProcessingPhase(latestApplication)} />
          ) : null}

          <p className="mt-5 text-sm text-slate-700">{STEP_MESSAGES[inscriptionStep]}</p>
          {inscriptionStep === "awaiting_payment" ? (
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Paiement : {PAYMENT_LABELS[latestApplication.paymentStatus]}
            </p>
          ) : null}
          {latestApplication.trialAttended ? <p className="mt-1 text-sm text-slate-600">Séance d&apos;essai réalisée.</p> : null}
          {!isInscriptionFinalized ? (
            <p className="mt-3 rounded-2xl bg-brand-cream px-4 py-3 text-sm text-slate-600">
              Les horaires et événements de votre activité seront visibles une fois l&apos;inscription finalisée par le
              bureau.
            </p>
          ) : null}
          {latestApplication.paymentStatus === "paid" ? (
            <div className="mt-4">
              <PaymentReceiptLink applicationId={latestApplication.id} className="btn btn-primary btn-sm">
                Télécharger mon attestation de paiement
              </PaymentReceiptLink>
            </div>
          ) : null}
        </section>
      ) : null}

      {isInscriptionFinalized && (nextSession || upcomingEvents.length > 0) ? (
        <div className={`grid gap-6 ${nextSession && upcomingEvents.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]" : ""}`}>
          {nextSession && nextColor ? (
            <section className="overflow-hidden rounded-3xl border border-brand-line bg-white lg:self-start">
              <div className="px-6 py-5" style={{ backgroundColor: nextColor.bg, color: nextColor.fg }}>
                <p className="text-sm font-semibold opacity-90">Ma prochaine séance</p>
                <p className="mt-1 text-2xl font-extrabold leading-tight">{nextSession.disciplineName}</p>
              </div>
              <dl className="space-y-3 px-6 py-5 text-[15px]">
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 font-bold text-slate-500">Quand</dt>
                  <dd className="font-semibold text-slate-900">
                    {nextSession.dayLabel}
                    {nextSession.date === todayIso ? (
                      <span className="ml-2 rounded-full bg-brand-blue px-2.5 py-0.5 text-xs font-bold text-white">
                        Aujourd&apos;hui
                      </span>
                    ) : null}
                    <span className="block font-normal text-slate-700">{timeRange(nextSession)}</span>
                  </dd>
                </div>
                {nextSession.location ? (
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 font-bold text-slate-500">Lieu</dt>
                    <dd className="text-slate-800">{nextSession.location}</dd>
                  </div>
                ) : null}
                {nextSession.teacherName ? (
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 font-bold text-slate-500">Coach</dt>
                    <dd className="text-slate-800">{nextSession.teacherName}</dd>
                  </div>
                ) : null}
              </dl>
              {nextSlug ? (
                <div className="px-6 pb-6">
                  <Link href={`/disciplines/${nextSlug}`} className="btn btn-outline btn-sm">
                    Voir la discipline
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}

          {upcomingEvents.length > 0 ? (
            <section id="evenements" className="anchor-section">
              <h2 className="text-xl font-extrabold text-slate-900">Événements à venir</h2>
              <p className="mt-1 text-sm text-slate-600">Pour vos activités et pour toute l&apos;association.</p>
              <ul className="mt-4 grid gap-4">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {isInscriptionFinalized && plannerWeeks.some((week) => week.entries.length > 0) ? (
        <section id="mon-planning" className="anchor-section panel p-6">
          <h2 className="text-xl font-extrabold text-slate-900">Mon planning</h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">
            Vos activités uniquement. Les cours annulés sont signalés en direct.
          </p>
          <WeekPlanner
            weeks={plannerWeeks}
            disciplines={plannerDisciplines}
            todayIso={todayIso}
            showEnrollCta={false}
          />
        </section>
      ) : null}

      {contactApplication ? (
        <MemberContactSection application={contactApplication} pendingRequest={contactChangeRequest} />
      ) : null}

      <MemberRequestsSection />

      <section id="mes-dossiers" className="anchor-section panel p-6">
        <h2 className="text-xl font-extrabold text-slate-900">Mes pré-inscriptions</h2>
        <div className="mt-4 space-y-3">
          {applications.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune pré-inscription pour le moment.</p>
          ) : (
            applications.map((application) => {
              const step = getMemberInscriptionStep(application);
              const applicationDisciplineIds =
                application.disciplineIds?.length
                  ? application.disciplineIds
                  : [application.disciplineId];
              const applicationDisciplineNames = disciplines
                .filter((discipline) => applicationDisciplineIds.includes(discipline.id))
                .map((discipline) => discipline.name);
              return (
                <article key={application.id} className="rounded-2xl border border-brand-line bg-brand-cream/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-extrabold text-slate-900">
                      {applicationDisciplineNames.length > 0
                        ? applicationDisciplineNames.join(", ")
                        : "Discipline"}
                    </p>
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${stepBadgeClass(step)}`}
                      >
                        {getMemberInscriptionLabel(application)}
                      </span>
                      {application.origin === "paper" ? (
                        <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                          Bulletin papier
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Essai : {application.trialAttended ? "réalisé" : "pas encore réalisé"}
                  </p>
                  {application.paymentStatus === "paid" ? (
                    <PaymentReceiptLink
                      applicationId={application.id}
                      className="mt-2 inline-block text-sm font-bold text-brand-blue hover:underline"
                    >
                      Télécharger l&apos;attestation de paiement
                    </PaymentReceiptLink>
                  ) : null}
                  {application.notes ? (
                    <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                      <span className="font-bold">Message du bureau :</span> {application.notes}
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>

      {pendingWithoutTrial.length > 0 ? (
        <section className="panel p-6">
          <h2 className="text-xl font-extrabold text-slate-900">Choisir un créneau d&apos;essai</h2>
          <div className="mt-3 space-y-3">
            {pendingWithoutTrial.map((application) => (
              <article key={application.id} className="rounded-2xl border border-brand-line bg-brand-cream/60 p-4">
                <p className="text-sm font-semibold text-slate-700">
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
                        className="rounded-full border border-brand-blue bg-white px-3.5 py-1.5 text-sm font-semibold text-brand-blue hover:bg-brand-blue/10"
                      >
                        {new Date(slot.startsAt).toLocaleDateString("fr-FR")} · {slot.title}
                      </button>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <AccountSettings hasContactSection={Boolean(contactApplication)} />

      <details className="group panel p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xl font-extrabold text-slate-900">
          Déposer une nouvelle pré-inscription
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 text-xl font-bold text-brand-blue transition group-open:rotate-45"
          >
            +
          </span>
        </summary>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="field-label">
            Prénom
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field" required />
          </label>
          <label className="field-label">
            Nom
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="field" required />
          </label>
          <label className="field-label">
            Téléphone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" required />
          </label>
          <label className="field-label">
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          </label>
          <label className="field-label sm:col-span-2">
            Adresse
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="field" required />
          </label>
          <label className="field-label">
            Code postal
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="field" required />
          </label>
          <label className="field-label">
            Ville
            <input value={city} onChange={(e) => setCity(e.target.value)} className="field" required />
          </label>
          <label className="field-label sm:col-span-2">
            Documents
            <input
              type="file"
              multiple
              onChange={handleFilesChange}
              disabled={isUploading}
              className="mt-1 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>
          <label className="field-label">
            Discipline
            <select
              value={disciplineId}
              onChange={(e) => {
                setDisciplineId(e.target.value);
                setTrialSlotId("");
              }}
              className="field"
            >
              {disciplines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Créneau d&apos;essai (facultatif)
            <select value={trialSlotId} onChange={(e) => setTrialSlotId(e.target.value)} className="field">
              <option value="">Plus tard</option>
              {disciplineSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {new Date(slot.startsAt).toLocaleString("fr-FR")} · {slot.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label sm:col-span-2">
            Motivation
            <textarea value={motivation} onChange={(e) => setMotivation(e.target.value)} className="field" rows={3} />
          </label>
          <button
            type="submit"
            disabled={isLoading || isUploading || !disciplineId}
            className="btn btn-primary sm:col-span-2"
          >
            Envoyer ma demande
          </button>
        </form>
        {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
      </details>
    </div>
  );
}
