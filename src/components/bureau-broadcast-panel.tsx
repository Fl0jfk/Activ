"use client";

import { FormEvent, useMemo, useState } from "react";
import type { RegistrationApplication } from "@/lib/club-data";
import type { DisciplineOption } from "@/lib/discipline-options";
import { getApplicationDisciplineIds } from "@/lib/dossier-workflow";

type BureauBroadcastPanelProps = {
  disciplines: DisciplineOption[];
  applications: RegistrationApplication[];
};

type AudienceMode = "all" | "discipline" | "person";

type ApprovedMember = {
  email: string;
  name: string;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function countPreview(
  applications: RegistrationApplication[],
  disciplineId: string,
): number {
  const emails = new Set(
    applications
      .filter((app) => app.status === "approved" && app.email?.trim())
      .filter((app) => {
        if (!disciplineId) return true;
        return getApplicationDisciplineIds(app).includes(disciplineId);
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
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const approvedMembers = useMemo(() => {
    const byEmail = new Map<string, ApprovedMember>();
    for (const app of applications) {
      if (app.status !== "approved" || !app.email?.trim()) continue;
      const email = app.email.trim().toLowerCase();
      if (byEmail.has(email)) continue;
      const name =
        app.fullName?.trim() ||
        [app.firstName, app.lastName].filter(Boolean).join(" ").trim() ||
        email;
      byEmail.set(email, { email, name });
    }
    return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [applications]);

  const memberMatches = useMemo(() => {
    const query = normalizeSearch(recipientQuery);
    if (!query) return approvedMembers;
    return approvedMembers.filter((member) =>
      normalizeSearch(member.name).includes(query),
    );
  }, [approvedMembers, recipientQuery]);

  const selectedMember = useMemo(
    () => approvedMembers.find((member) => member.email === recipientEmail) ?? null,
    [approvedMembers, recipientEmail],
  );

  const recipientCount = useMemo(() => {
    if (audienceMode === "person") {
      return selectedMember ? 1 : 0;
    }
    return countPreview(applications, audienceMode === "discipline" ? disciplineId : "");
  }, [applications, audienceMode, disciplineId, selectedMember]);

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
      setStatusMessage("Choisissez une personne dans la liste.");
      return;
    }
    if (recipientCount === 0) {
      setStatusMessage("Aucun destinataire pour cette sélection.");
      return;
    }

    const destination =
      audienceMode === "person"
        ? selectedMember
          ? `${selectedMember.name} (${selectedMember.email})`
          : recipientEmail.trim()
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
      setRecipientEmail("");
      setRecipientQuery("");
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
          <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            <label htmlFor="broadcast-recipient-search">Nom de la personne</label>
            <input
              id="broadcast-recipient-search"
              type="search"
              value={recipientQuery}
              onChange={(event) => setRecipientQuery(event.target.value)}
              disabled={isSending}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              placeholder="Rechercher un nom ou un prénom…"
              autoComplete="off"
            />

            {approvedMembers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm font-normal text-slate-500">
                Aucun adhérent approuvé pour le moment.
              </p>
            ) : (
              <div
                role="listbox"
                aria-label="Adhérents approuvés"
                className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white"
              >
                {memberMatches.length > 0 ? (
                  memberMatches.map((member) => {
                    const selected = member.email === recipientEmail;
                    return (
                      <button
                        key={member.email}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => setRecipientEmail(member.email)}
                        disabled={isSending}
                        className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left text-sm font-normal transition last:border-b-0 ${
                          selected
                            ? "bg-emerald-50 text-emerald-900"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0 truncate">{member.name}</span>
                        {selected ? (
                          <span className="shrink-0 text-xs font-semibold text-emerald-700">
                            Sélectionné
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-3 text-sm font-normal text-slate-500">
                    Aucun adhérent ne correspond à « {recipientQuery.trim()} ».
                  </p>
                )}
              </div>
            )}

            {selectedMember ? (
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 font-normal">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Destinataire sélectionné
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-950">
                  {selectedMember.name}
                </p>
                <p className="mt-0.5 break-all text-xs text-emerald-800">
                  {selectedMember.email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientEmail("");
                    setRecipientQuery("");
                  }}
                  disabled={isSending}
                  className="mt-2 text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
                >
                  Changer de personne
                </button>
              </div>
            ) : (
              <span className="mt-1 text-xs font-normal text-slate-500">
                Choisissez une personne dans la liste : seuls les adhérents approuvés sont
                proposés.
              </span>
            )}
          </div>
        ) : null}

        {audienceMode !== "person" ? (
          <p className="text-sm text-slate-600">
            Environ <strong>{recipientCount}</strong> destinataire
            {recipientCount > 1 ? "s" : ""} (aperçu).
          </p>
        ) : null}

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
