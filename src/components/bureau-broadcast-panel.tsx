"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BroadcastPersonPicker from "@/components/broadcast-person-picker";
import BroadcastResult, {
  BroadcastDeliveryTips,
  type BroadcastSendSummary,
} from "@/components/broadcast-result";
import BroadcastReviewDialog from "@/components/broadcast-review-dialog";
import { SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import {
  BROADCAST_MESSAGE_MAX,
  BROADCAST_SUBJECT_MAX,
  type BroadcastAudienceResponse,
  type BroadcastRecipient,
  type BroadcastSendResponse,
} from "@/lib/broadcast-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import { fetchJson, jsonInit } from "@/lib/fetch-json";

type BureauBroadcastPanelProps = {
  disciplines: DisciplineOption[];
};

type AudienceMode = "all" | "discipline" | "person";

type Overview = {
  people: BroadcastRecipient[];
  disciplineCounts: Record<string, number>;
};

const ENDPOINT = "/api/club/broadcast-email";

function peopleLabel(count: number): string {
  return `${count} personne${count > 1 ? "s" : ""}`;
}

function audienceQuery(mode: AudienceMode | null, disciplineId: string, email: string): string {
  const params = new URLSearchParams();
  if (mode === "discipline") params.set("disciplineId", disciplineId);
  if (mode === "person") params.set("recipientEmail", email);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function CharCounter({ value, max }: { value: number; max: number }) {
  return (
    <span className={`text-sm ${value > max * 0.9 ? "font-semibold text-amber-700" : "text-slate-500"}`}>
      {value} / {max} caractères
    </span>
  );
}

export default function BureauBroadcastPanel({ disciplines }: BureauBroadcastPanelProps) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [audienceMode, setAudienceMode] = useState<AudienceMode | null>(null);
  const [disciplineId, setDisciplineId] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [pageFeedback, setPageFeedback] = useState<Feedback>(null);
  const [reviewFeedback, setReviewFeedback] = useState<Feedback>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [reviewRecipients, setReviewRecipients] = useState<BroadcastRecipient[] | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [summary, setSummary] = useState<BroadcastSendSummary | null>(null);

  const sendingRef = useRef(false);
  const testingRef = useRef(false);

  const applyOverview = useCallback(
    (result: Awaited<ReturnType<typeof fetchJson<BroadcastAudienceResponse>>>) => {
      if (!result.ok || !result.data) {
        setOverview(null);
        setOverviewError(result.message || "La liste des adhérents n’a pas pu être chargée.");
        return;
      }
      setOverviewError("");
      setOverview({
        people: result.data.recipients,
        disciplineCounts: result.data.disciplineCounts ?? {},
      });
    },
    [],
  );

  const loadOverview = useCallback(async () => {
    applyOverview(await fetchJson<BroadcastAudienceResponse>(ENDPOINT));
  }, [applyOverview]);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<BroadcastAudienceResponse>(ENDPOINT).then((result) => {
      if (!cancelled) applyOverview(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyOverview]);

  const totalCount = overview?.people.length ?? 0;
  const disciplineName = disciplines.find((entry) => entry.id === disciplineId)?.name ?? "";
  const selectedPerson = overview?.people.find((person) => person.email === personEmail) ?? null;

  let recipientCount = 0;
  let audienceLabel = "";
  if (audienceMode === "all") {
    recipientCount = totalCount;
    audienceLabel = "Tous les adhérents";
  } else if (audienceMode === "discipline" && disciplineId) {
    recipientCount = overview?.disciplineCounts[disciplineId] ?? 0;
    audienceLabel = `Activité : ${disciplineName}`;
  } else if (audienceMode === "person" && selectedPerson) {
    recipientCount = 1;
    audienceLabel = selectedPerson.name;
  }

  function validate(kind: "test" | "send"): string | null {
    if (!subject.trim()) return "Écrivez l’objet de votre message (étape 2).";
    if (!message.trim()) return "Écrivez votre message (étape 2).";
    if (kind === "test") return null;
    if (!overview) return "La liste des adhérents n’est pas encore chargée. Patientez un instant.";
    if (!audienceMode) return "Choisissez d’abord à qui envoyer le message (étape 1).";
    if (audienceMode === "discipline" && !disciplineId) return "Choisissez une activité (étape 1).";
    if (audienceMode === "person" && !selectedPerson) return "Choisissez une personne (étape 1).";
    if (recipientCount === 0) return "Aucun adhérent ne correspond à cette sélection.";
    return null;
  }

  async function handleOpenReview() {
    const problem = validate("send");
    if (problem) {
      setPageFeedback({ tone: "error", text: problem });
      return;
    }
    setIsPreparing(true);
    setPageFeedback(null);
    try {
      // La liste est relue au moment de la relecture : elle reflète l'état réel du serveur.
      const result = await fetchJson<BroadcastAudienceResponse>(
        `${ENDPOINT}${audienceQuery(audienceMode, disciplineId, personEmail)}`,
      );
      if (!result.ok || !result.data) {
        setPageFeedback({
          tone: "error",
          text: result.message || "La liste des destinataires n’a pas pu être chargée. Réessayez.",
        });
        return;
      }
      if (result.data.recipients.length === 0) {
        setPageFeedback({ tone: "error", text: "Aucun adhérent ne correspond à cette sélection." });
        return;
      }
      setReviewRecipients(result.data.recipients);
      setReviewFeedback(null);
      setReviewVersion((version) => version + 1);
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleSendTest(target: "page" | "dialog") {
    const setFeedback = target === "page" ? setPageFeedback : setReviewFeedback;
    const problem = validate("test");
    if (problem) {
      setFeedback({ tone: "error", text: problem });
      return;
    }
    if (testingRef.current) return;
    testingRef.current = true;
    setIsTesting(true);
    setFeedback(null);
    try {
      const result = await fetchJson<BroadcastSendResponse>(
        ENDPOINT,
        jsonInit("POST", { testToSelf: true, subject: subject.trim(), message: message.trim() }),
      );
      setFeedback(
        result.ok
          ? { tone: "success", text: result.message || "Test envoyé à votre adresse." }
          : { tone: "error", text: result.message || "Le test n’a pas pu être envoyé." },
      );
    } finally {
      testingRef.current = false;
      setIsTesting(false);
    }
  }

  async function handleSend() {
    if (sendingRef.current || !reviewRecipients) return;
    sendingRef.current = true;
    setIsSending(true);
    setReviewFeedback(null);
    try {
      const result = await fetchJson<BroadcastSendResponse>(
        ENDPOINT,
        jsonInit("POST", {
          disciplineId: audienceMode === "discipline" ? disciplineId : null,
          recipientEmail: audienceMode === "person" ? personEmail : null,
          subject: subject.trim(),
          message: message.trim(),
          expectedRecipientCount: reviewRecipients.length,
        }),
      );
      if (!result.ok || !result.data) {
        setReviewFeedback({
          tone: "error",
          text: result.message || "L’envoi a échoué. Aucun message n’a été confirmé : réessayez.",
        });
        if (result.status === 409) {
          const refreshed = await fetchJson<BroadcastAudienceResponse>(
            `${ENDPOINT}${audienceQuery(audienceMode, disciplineId, personEmail)}`,
          );
          if (refreshed.ok && refreshed.data && refreshed.data.recipients.length > 0) {
            setReviewRecipients(refreshed.data.recipients);
            setReviewVersion((version) => version + 1);
          }
        }
        return;
      }
      setSummary({
        response: result.data,
        audienceLabel,
        subject: subject.trim(),
        sentAt: new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }),
      });
      setReviewRecipients(null);
      setPageFeedback(null);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }

  function handleCloseReview() {
    if (sendingRef.current) return;
    setReviewRecipients(null);
  }

  function handleNewMessage() {
    setSummary(null);
    setAudienceMode(null);
    setDisciplineId("");
    setPersonEmail("");
    setSubject("");
    setMessage("");
    setPageFeedback(null);
    setReviewFeedback(null);
    void loadOverview();
  }

  if (summary) {
    return (
      <BroadcastResult
        summary={summary}
        onNewMessage={handleNewMessage}
        onBackToMessage={() => setSummary(null)}
      />
    );
  }

  const audienceOptions: { mode: AudienceMode; title: string; detail: string }[] = [
    {
      mode: "all",
      title: "Tous les adhérents",
      detail: overview ? peopleLabel(totalCount) : "Chargement…",
    },
    {
      mode: "discipline",
      title: "Une activité",
      detail:
        audienceMode === "discipline" && disciplineId
          ? peopleLabel(recipientCount)
          : "Choisir dans la liste",
    },
    {
      mode: "person",
      title: "Une personne",
      detail: selectedPerson ? selectedPerson.name : "Choisir dans la liste",
    },
  ];

  const busy = isPreparing || isSending || isTesting;

  return (
    <div className="space-y-5">
      <SectionCard
        eyebrow="Étape 1 sur 3"
        title="Destinataires"
        description="Choisissez qui doit recevoir ce message. Chacun le reçoit sans voir les adresses des autres."
      >
        {overviewError ? (
          <div className="space-y-3">
            <StatusMessage feedback={{ tone: "error", text: overviewError }} />
            <button
              type="button"
              onClick={() => {
                setOverviewError("");
                void loadOverview();
              }}
              className="btn btn-outline btn-sm"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <fieldset disabled={busy} className="min-w-0">
              <legend className="sr-only">À qui envoyer le message ?</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {audienceOptions.map((option) => (
                  <label key={option.mode} className="block cursor-pointer">
                    <input
                      type="radio"
                      name="broadcast-audience"
                      value={option.mode}
                      checked={audienceMode === option.mode}
                      onChange={() => {
                        setAudienceMode(option.mode);
                        setPageFeedback(null);
                      }}
                      className="peer sr-only"
                    />
                    <span className="flex h-full min-h-24 items-start gap-3 rounded-2xl border-2 border-slate-300 bg-white p-4 transition hover:border-brand-blue/60 peer-checked:border-brand-blue peer-checked:bg-brand-blue/5 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-blue/30 peer-disabled:opacity-60 peer-checked:[&_.radio-dot]:border-brand-blue peer-checked:[&_.radio-dot]:bg-brand-blue peer-checked:[&_.radio-dot]:shadow-[inset_0_0_0_3px_#fff]">
                      <span
                        aria-hidden="true"
                        className="radio-dot mt-1 h-5 w-5 shrink-0 rounded-full border-2 border-slate-400 bg-white"
                      />
                      <span className="min-w-0">
                        <span className="block text-lg font-extrabold leading-tight text-slate-900">
                          {option.title}
                        </span>
                        <span className="mt-1 block break-words text-sm font-semibold text-slate-600">
                          {option.detail}
                        </span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {audienceMode === "discipline" ? (
              <div className="mt-4">
                <label htmlFor="broadcast-discipline" className="field-label">
                  Activité
                </label>
                <select
                  id="broadcast-discipline"
                  value={disciplineId}
                  onChange={(event) => {
                    setDisciplineId(event.target.value);
                    setPageFeedback(null);
                  }}
                  disabled={busy}
                  className="field text-base"
                >
                  <option value="">Choisir une activité…</option>
                  {disciplines.map((discipline) => (
                    <option key={discipline.id} value={discipline.id}>
                      {discipline.name}
                      {overview ? ` (${peopleLabel(overview.disciplineCounts[discipline.id] ?? 0)})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {audienceMode === "person" && overview ? (
              <div className="mt-4">
                <BroadcastPersonPicker
                  people={overview.people}
                  selectedEmail={personEmail}
                  onSelect={(email) => {
                    setPersonEmail(email);
                    setPageFeedback(null);
                  }}
                  disabled={busy}
                />
              </div>
            ) : null}

            <p aria-live="polite" className="mt-4 text-[15px] font-semibold text-slate-800">
              {audienceMode && audienceLabel
                ? recipientCount > 0
                  ? `Ce message sera envoyé à ${peopleLabel(recipientCount)} (${audienceLabel}).`
                  : "Aucun adhérent ne correspond à cette sélection."
                : ""}
            </p>
          </>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Étape 2 sur 3"
        title="Message"
        description="Écrivez simplement, comme dans un courrier. Le texte est envoyé tel quel."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="broadcast-subject" className="field-label">
              Objet
            </label>
            <input
              id="broadcast-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              disabled={busy}
              className="field text-base"
              placeholder="Ex. : Reprise des cours le 8 septembre"
              maxLength={BROADCAST_SUBJECT_MAX}
            />
            <div className="mt-1 text-right">
              <CharCounter value={subject.length} max={BROADCAST_SUBJECT_MAX} />
            </div>
          </div>
          <div>
            <label htmlFor="broadcast-message" className="field-label">
              Votre message
            </label>
            <textarea
              id="broadcast-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={busy}
              className="field text-base leading-6"
              rows={10}
              placeholder={"Bonjour,\n\nNous vous informons que…"}
              maxLength={BROADCAST_MESSAGE_MAX}
            />
            <div className="mt-1 text-right">
              <CharCounter value={message.length} max={BROADCAST_MESSAGE_MAX} />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Étape 3 sur 3"
        title="Relecture et envoi"
        description="Vous verrez la liste des destinataires et le message avant l’envoi. Vous pouvez aussi vous envoyer un test."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleOpenReview()}
              disabled={busy}
              className="btn btn-primary"
            >
              {isPreparing ? "Chargement…" : "Relire avant d’envoyer"}
            </button>
            <button
              type="button"
              onClick={() => void handleSendTest("page")}
              disabled={busy}
              className="btn btn-outline"
            >
              {isTesting ? "Envoi du test…" : "M’envoyer un test"}
            </button>
          </div>
          <div aria-live="polite">
            <StatusMessage feedback={pageFeedback} />
          </div>
          <BroadcastDeliveryTips />
        </div>
      </SectionCard>

      {reviewRecipients ? (
        <BroadcastReviewDialog
          key={reviewVersion}
          audienceLabel={audienceLabel}
          recipients={reviewRecipients}
          subject={subject.trim()}
          message={message.trim()}
          requireConfirmation={audienceMode === "all"}
          sending={isSending}
          testing={isTesting}
          feedback={reviewFeedback}
          onSend={() => void handleSend()}
          onSendTest={() => void handleSendTest("dialog")}
          onClose={handleCloseReview}
        />
      ) : null}
    </div>
  );
}
