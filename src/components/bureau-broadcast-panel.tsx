"use client";

import { FormEvent, useMemo, useState } from "react";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";

type BureauBroadcastPanelProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
};

type AudienceMode = "all" | "discipline" | "person";

function countPreview(
  applications: RegistrationApplication[],
  disciplineId: string,
): number {
  const emails = new Set(
    applications
      .filter((app) => app.status === "approved" && app.email?.trim())
      .filter((app) => {
        if (!disciplineId) return true;
        if (app.disciplineId === disciplineId) return true;
        return Boolean(app.disciplineIds?.includes(disciplineId));
      })
      .map((app) => app.email.trim().toLowerCase()),
  );
  return emails.size;
}

export default function BureauBroadcastPanel({
  disciplines,
  applications,
}: BureauBroadcastPanelProps) {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [disciplineId, setDisciplineId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const approvedEmails = useMemo(() => {
    const emails = new Set(
      applications
        .filter((app) => app.status === "approved" && app.email?.trim())
        .map((app) => app.email.trim().toLowerCase()),
    );
    return [...emails].sort();
  }, [applications]);

  const recipientCount = useMemo(() => {
    if (audienceMode === "person") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()) ? 1 : 0;
    }
    return countPreview(applications, audienceMode === "discipline" ? disciplineId : "");
  }, [applications, audienceMode, disciplineId, recipientEmail]);

  const canSend =
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    (audienceMode !== "discipline" || Boolean(disciplineId)) &&
    recipientCount > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setStatusMessage("L'objet et le message sont obligatoires.");
      return;
    }
    if (audienceMode === "discipline" && !disciplineId) {
      setStatusMessage("Choisissez une activité.");
      return;
    }
    if (audienceMode === "person" && !recipientCount) {
      setStatusMessage("Saisissez une adresse e-mail valide.");
      return;
    }
    if (recipientCount === 0) {
      setStatusMessage("Aucun destinataire pour cette sélection.");
      return;
    }

    const destination =
      audienceMode === "person"
        ? recipientEmail.trim()
        : `${recipientCount} destinataire${recipientCount > 1 ? "s" : ""}`;
    const confirmed = window.confirm(`Envoyer cet e-mail à ${destination} ?`);
    if (!confirmed) return;

    setIsSending(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/club/broadcast-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplineId: audienceMode === "discipline" ? disciplineId : null,
          recipientEmail: audienceMode === "person" ? recipientEmail.trim() : null,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Envoi impossible.");
      }
      setStatusMessage(payload.message ?? "E-mail envoyé.");
      setSubject("");
      setMessage("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="bento-card p-5">
      <h2 className="text-lg font-bold text-slate-900">Envoyer un e-mail</h2>
      <p className="mt-1 text-sm text-slate-600">
        Message à tous les adhérents, à une activité ou à une personne. Chaque destinataire reçoit
        un e-mail individuel (les autres adresses ne sont pas visibles).
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Destinataires
          <select
            value={audienceMode}
            onChange={(event) => setAudienceMode(event.target.value as AudienceMode)}
            disabled={isSending}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="all">Tous les adhérents</option>
            <option value="discipline">Par activité</option>
            <option value="person">Une personne</option>
          </select>
        </label>

        {audienceMode === "discipline" ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Activité
            <select
              value={disciplineId}
              onChange={(event) => setDisciplineId(event.target.value)}
              disabled={isSending}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            >
              <option value="">Choisir une activité…</option>
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {audienceMode === "person" ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Adresse e-mail de l&apos;adhérent
            <input
              type="email"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
              disabled={isSending}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              placeholder="prenom.nom@exemple.fr"
              list="approved-member-emails"
              required
            />
            <datalist id="approved-member-emails">
              {approvedEmails.map((email) => (
                <option key={email} value={email} />
              ))}
            </datalist>
            <span className="text-xs font-normal text-slate-500">
              Seules les adresses d&apos;adhérents approuvés peuvent recevoir ces messages.
            </span>
          </label>
        ) : null}

        <p className="text-sm text-slate-600">
          {audienceMode === "person" ? (
            recipientCount > 0 ? (
              <>
                Destinataire : <strong>{recipientEmail.trim()}</strong>
              </>
            ) : (
              "Saisissez une adresse e-mail valide."
            )
          ) : (
            <>
              Environ <strong>{recipientCount}</strong> destinataire
              {recipientCount > 1 ? "s" : ""} (aperçu).
            </>
          )}
        </p>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Objet
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={isSending}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            placeholder="Ex. Info rentrée, rappel cotisation…"
            maxLength={200}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSending}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            rows={6}
            placeholder="Bonjour,&#10;&#10;Nous vous informons que…"
            maxLength={8000}
            required
          />
        </label>

        <button
          type="submit"
          disabled={isSending || !canSend}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {isSending ? "Envoi en cours…" : "Envoyer"}
        </button>
      </form>

      {statusMessage ? <p className="mt-3 text-sm text-slate-700">{statusMessage}</p> : null}
    </section>
  );
}
