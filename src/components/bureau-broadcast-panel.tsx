"use client";

import { FormEvent, useMemo, useState } from "react";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";

type BureauBroadcastPanelProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
};

function countPreview(
  applications: RegistrationApplication[],
  disciplineId: string,
): number {
  const emails = new Set(
    applications
      .filter((app) => app.status === "approved" && app.email?.trim())
      .filter((app) => !disciplineId || app.disciplineId === disciplineId)
      .map((app) => app.email.trim().toLowerCase()),
  );
  return emails.size;
}

export default function BureauBroadcastPanel({
  disciplines,
  applications,
}: BureauBroadcastPanelProps) {
  const [audience, setAudience] = useState<string>("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const recipientCount = useMemo(
    () => countPreview(applications, audience === "all" ? "" : audience),
    [applications, audience],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setStatusMessage("L'objet et le message sont obligatoires.");
      return;
    }
    if (recipientCount === 0) {
      setStatusMessage("Aucun destinataire pour cette sélection.");
      return;
    }

    const confirmed = window.confirm(
      `Envoyer cet e-mail à ${recipientCount} destinataire${recipientCount > 1 ? "s" : ""} ?`,
    );
    if (!confirmed) return;

    setIsSending(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/club/broadcast-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disciplineId: audience === "all" ? null : audience,
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
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-cyan-50/40 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Envoyer un e-mail</h2>
      <p className="mt-1 text-sm text-slate-600">
        Message aux adhérents approuvés, tous ou par discipline. Chaque personne reçoit un e-mail
        individuel (les autres destinataires ne sont pas visibles).
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Destinataires
          <select
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            disabled={isSending}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            <option value="all">Tous les adhérents</option>
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        </label>

        <p className="text-sm text-slate-600">
          Environ <strong>{recipientCount}</strong> destinataire
          {recipientCount > 1 ? "s" : ""} (aperçu).
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
          disabled={isSending || recipientCount === 0}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {isSending ? "Envoi en cours…" : "Envoyer"}
        </button>
      </form>

      {statusMessage ? <p className="mt-3 text-sm text-slate-700">{statusMessage}</p> : null}
    </section>
  );
}
