"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useState, useTransition } from "react";
import { Badge, EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import type { MemberRequest, MemberRequestDocument } from "@/lib/club-data";
import { RichTextContent } from "@/lib/chat-message-links";
import { fetchJson, jsonInit, type ApiResult } from "@/lib/fetch-json";
import { MEMBER_REQUEST_STATUS_LABELS } from "@/lib/member-request";

type Draft = { reply: string; attachment: MemberRequestDocument | null };

type RequestsResult = ApiResult<{ open?: MemberRequest[]; recent?: MemberRequest[] }>;

function fetchRequests(): Promise<RequestsResult> {
  return fetchJson<{ open?: MemberRequest[]; recent?: MemberRequest[] }>("/api/club/member-requests");
}

export default function MemberRequestsPanel() {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [open, setOpen] = useState<MemberRequest[]>([]);
  const [recent, setRecent] = useState<MemberRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [itemFeedback, setItemFeedback] = useState<Record<string, Feedback>>({});
  const [doneFeedback, setDoneFeedback] = useState<Feedback>(null);
  const [treatDrafts, setTreatDrafts] = useState<Record<string, Draft>>({});

  const applyResult = useCallback((result: RequestsResult) => {
    if (!result.ok || !result.data) {
      setLoadError(result.message || "Impossible de charger les demandes des membres.");
    } else {
      setLoadError("");
      setOpen(result.data.open ?? []);
      setRecent(result.data.recent ?? []);
    }
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    applyResult(await fetchRequests());
  }, [applyResult]);

  useEffect(() => {
    let cancelled = false;
    void fetchRequests().then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  function retryLoad() {
    setLoading(true);
    void load();
  }

  function draftFor(id: string): Draft {
    return treatDrafts[id] ?? { reply: "", attachment: null };
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setTreatDrafts((previous) => ({
      ...previous,
      [id]: { ...draftFor(id), ...patch },
    }));
  }

  function setFeedbackFor(id: string, feedback: Feedback) {
    setItemFeedback((previous) => ({ ...previous, [id]: feedback }));
  }

  async function handleAttachment(requestId: string, event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    setBusyId(requestId);
    setFeedbackFor(requestId, null);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await fetchJson<Partial<MemberRequestDocument>>("/api/club/documents", {
        method: "POST",
        body,
      });
      const uploaded = result.data;
      if (!result.ok || !uploaded?.name || !uploaded.url || !uploaded.uploadedAt) {
        setFeedbackFor(requestId, {
          tone: "error",
          text: result.message || "Le fichier n’a pas pu être envoyé. Vérifiez-le puis réessayez.",
        });
        return;
      }
      updateDraft(requestId, {
        attachment: { name: uploaded.name, url: uploaded.url, uploadedAt: uploaded.uploadedAt },
      });
      setFeedbackFor(requestId, { tone: "success", text: "Pièce jointe ajoutée." });
    } finally {
      setBusyId(null);
      input.value = "";
    }
  }

  async function startRequest(request: MemberRequest) {
    setBusyId(request.id);
    setFeedbackFor(request.id, null);
    setDoneFeedback(null);
    try {
      const result = await fetchJson(
        `/api/club/member-requests/${request.id}`,
        jsonInit("PATCH", { action: "start" }),
      );
      if (!result.ok) {
        setFeedbackFor(request.id, {
          tone: "error",
          text: result.message || "La demande n’a pas pu être prise en charge. Réessayez dans un instant.",
        });
        return;
      }
      setFeedbackFor(request.id, { tone: "success", text: "Vous avez pris cette demande en charge." });
      await load();
      startRefresh(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  async function treatRequest(request: MemberRequest) {
    const draft = draftFor(request.id);
    if (!draft.reply.trim()) {
      setFeedbackFor(request.id, {
        tone: "error",
        text: "Écrivez d’abord un message de réponse pour l’adhérent, puis marquez la demande comme traitée.",
      });
      return;
    }
    setBusyId(request.id);
    setFeedbackFor(request.id, null);
    setDoneFeedback(null);
    try {
      const result = await fetchJson(
        `/api/club/member-requests/${request.id}`,
        jsonInit("PATCH", {
          action: "treat",
          bureauReply: draft.reply,
          bureauAttachment: draft.attachment,
        }),
      );
      if (!result.ok) {
        setFeedbackFor(request.id, {
          tone: "error",
          text: result.message || "La réponse n’a pas pu être enregistrée. Réessayez dans un instant.",
        });
        return;
      }
      setTreatDrafts((previous) => {
        const next = { ...previous };
        delete next[request.id];
        return next;
      });
      setDoneFeedback({
        tone: "success",
        text: `La demande « ${request.subject} » est traitée : ${request.memberName} peut lire votre réponse.`,
      });
      await load();
      startRefresh(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SectionCard
      id="demandes"
      eyebrow="Bureau · Demandes"
      title="Demandes des membres"
      description="Demandes envoyées depuis l’espace personnel. Prenez-les en charge, répondez, puis marquez-les comme traitées."
      action={!loading && open.length > 0 ? <Badge tone="orange">{open.length} en attente</Badge> : null}
    >
      {loading ? (
        <p className="text-sm text-slate-600">Chargement des demandes…</p>
      ) : (
        <div className="space-y-4">
          <StatusMessage feedback={doneFeedback} />

          {loadError ? (
            <div className="space-y-3">
              <StatusMessage feedback={{ tone: "error", text: loadError }} />
              <button type="button" onClick={retryLoad} className="btn btn-outline btn-sm">
                Réessayer
              </button>
            </div>
          ) : null}

          {!loadError && open.length === 0 ? <EmptyState>Aucune demande en attente.</EmptyState> : null}

          {open.length > 0 ? (
            <div className="space-y-3">
              {open.map((request) => {
                const draft = draftFor(request.id);
                const busy = busyId === request.id;
                return (
                  <article
                    key={request.id}
                    className="min-w-0 rounded-2xl border border-brand-blue/25 bg-brand-blue/5 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-base font-extrabold text-slate-900">{request.subject}</p>
                      <Badge tone={request.status === "in_progress" ? "orange" : "blue"}>
                        {MEMBER_REQUEST_STATUS_LABELS[request.status]}
                      </Badge>
                    </div>
                    <p className="text-break mt-1 text-sm text-slate-700">
                      {request.memberName} — {request.memberEmail}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Reçue le{" "}
                      {new Date(request.createdAt).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <RichTextContent content={request.message} className="mt-2 text-sm text-slate-800" />
                    {request.attachment ? (
                      <a
                        href={`/api/club/member-requests/${request.id}/file?which=member`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-break mt-2 inline-block max-w-full text-sm font-semibold text-brand-blue underline"
                      >
                        Pièce jointe de l’adhérent ({request.attachment.name})
                      </a>
                    ) : null}

                    <div className="mt-4 space-y-3 rounded-2xl bg-white p-4">
                      {request.status === "received" ? (
                        <div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void startRequest(request)}
                            className="btn btn-outline btn-sm"
                          >
                            Prendre en charge
                          </button>
                          <p className="mt-1 text-sm text-slate-600">
                            Indique aux autres membres du bureau que vous vous en occupez.
                          </p>
                        </div>
                      ) : null}

                      <label className="field-label">
                        Votre réponse à l’adhérent
                        <textarea
                          value={draft.reply}
                          onChange={(event) => updateDraft(request.id, { reply: event.target.value })}
                          className="field"
                          rows={3}
                          placeholder="Cette réponse sera visible par l’adhérent…"
                          disabled={busy}
                        />
                      </label>
                      <label className="field-label">
                        Pièce jointe (facultatif)
                        <input
                          type="file"
                          onChange={(event) => void handleAttachment(request.id, event)}
                          disabled={busy}
                          className="field"
                        />
                      </label>
                      {draft.attachment ? (
                        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                          Fichier joint : {draft.attachment.name}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => updateDraft(request.id, { attachment: null })}
                          >
                            Retirer
                          </button>
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void treatRequest(request)}
                        className="btn btn-primary btn-sm"
                      >
                        {busy ? "Envoi…" : "Marquer comme traitée"}
                      </button>
                      <StatusMessage feedback={itemFeedback[request.id] ?? null} />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {recent.length > 0 ? (
            <details className="rounded-2xl border border-brand-line bg-white p-4">
              <summary className="cursor-pointer text-[15px] font-bold text-slate-900">
                Demandes déjà traitées ({recent.length})
              </summary>
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                {recent.map((request) => (
                  <li key={request.id} className="rounded-xl border border-brand-line bg-brand-cream/60 p-3">
                    <p className="font-semibold text-slate-900">
                      {request.subject}{" "}
                      <span className="font-normal text-slate-600">— {request.memberName}</span>
                    </p>
                    {request.bureauReply ? (
                      <RichTextContent content={request.bureauReply} className="mt-1 text-slate-700" />
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
