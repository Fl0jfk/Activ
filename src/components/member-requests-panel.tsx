"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import type { MemberRequest, MemberRequestDocument } from "@/lib/club-data";
import { RichTextContent } from "@/lib/chat-message-links";
import {
  MEMBER_REQUEST_STATUS_LABELS,
  memberRequestStatusBadgeClass,
} from "@/lib/member-request";

export default function MemberRequestsPanel() {
  const [open, setOpen] = useState<MemberRequest[]>([]);
  const [recent, setRecent] = useState<MemberRequest[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [treatDrafts, setTreatDrafts] = useState<
    Record<string, { reply: string; attachment: MemberRequestDocument | null }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/club/member-requests");
    if (!response.ok) {
      setStatusMessage("Impossible de charger les demandes membres.");
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as {
      open?: MemberRequest[];
      recent?: MemberRequest[];
    };
    setOpen(payload.open ?? []);
    setRecent(payload.recent ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function draftFor(id: string) {
    return treatDrafts[id] ?? { reply: "", attachment: null };
  }

  function updateDraft(
    id: string,
    patch: Partial<{ reply: string; attachment: MemberRequestDocument | null }>,
  ) {
    setTreatDrafts((previous) => ({
      ...previous,
      [id]: { ...draftFor(id), ...patch },
    }));
  }

  async function uploadDocument(file: File): Promise<MemberRequestDocument> {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/club/documents", { method: "POST", body });
    const payload = (await response.json()) as MemberRequestDocument & { message?: string };
    if (!response.ok || !payload.name || !payload.url || !payload.uploadedAt) {
      throw new Error(payload.message ?? "Upload impossible.");
    }
    return { name: payload.name, url: payload.url, uploadedAt: payload.uploadedAt };
  }

  async function handleAttachment(
    requestId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusyId(requestId);
    setStatusMessage("");
    try {
      const uploaded = await uploadDocument(file);
      updateDraft(requestId, { attachment: uploaded });
      setStatusMessage("Pièce jointe ajoutée.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Erreur d'upload.");
    } finally {
      setBusyId(null);
      event.target.value = "";
    }
  }

  async function startRequest(id: string) {
    setBusyId(id);
    setStatusMessage("");
    const response = await fetch(`/api/club/member-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const payload = (await response.json()) as { message?: string };
    setStatusMessage(payload.message ?? (response.ok ? "OK" : "Erreur."));
    setBusyId(null);
    if (response.ok) await load();
  }

  async function treatRequest(id: string) {
    const draft = draftFor(id);
    if (!draft.reply.trim()) {
      setStatusMessage("Ajoutez un message de réponse avant de clôturer.");
      return;
    }
    setBusyId(id);
    setStatusMessage("");
    const response = await fetch(`/api/club/member-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "treat",
        bureauReply: draft.reply,
        bureauAttachment: draft.attachment,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setStatusMessage(payload.message ?? (response.ok ? "OK" : "Erreur."));
    setBusyId(null);
    if (response.ok) {
      setTreatDrafts((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      await load();
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Chargement des demandes membres…</p>;
  }

  return (
    <div className="space-y-4">
      {statusMessage ? (
        <p className="text-sm text-slate-700" role="status">
          {statusMessage}
        </p>
      ) : null}

      {open.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          Aucune demande en attente.
        </p>
      ) : (
        <div className="space-y-3">
          {open.map((request) => {
            const draft = draftFor(request.id);
            const busy = busyId === request.id;
            return (
              <article
                key={request.id}
                className="min-w-0 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{request.subject}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${memberRequestStatusBadgeClass(request.status)}`}
                  >
                    {MEMBER_REQUEST_STATUS_LABELS[request.status]}
                  </span>
                </div>
                <p className="text-break mt-1 text-sm text-slate-700">
                  {request.memberName} — {request.memberEmail}
                </p>
                <p className="mt-1 text-xs text-slate-500">
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
                    className="text-break mt-2 inline-block max-w-full text-sm font-semibold text-cyan-900 underline"
                  >
                    Pièce jointe membre ({request.attachment.name})
                  </a>
                ) : null}

                <div className="mt-4 space-y-2 rounded-lg border border-white/80 bg-white/80 p-3">
                  {request.status === "received" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void startRequest(request.id)}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Prendre en charge
                    </button>
                  ) : null}

                  <label className="block text-sm font-medium text-slate-700">
                    Message de réponse
                    <textarea
                      value={draft.reply}
                      onChange={(event) => updateDraft(request.id, { reply: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                      rows={3}
                      placeholder="Réponse visible par le membre…"
                      disabled={busy}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Pièce jointe bureau (optionnel)
                    <input
                      type="file"
                      onChange={(event) => void handleAttachment(request.id, event)}
                      disabled={busy}
                      className="mt-1 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                    />
                  </label>
                  {draft.attachment ? (
                    <p className="text-xs text-slate-600">
                      Fichier : {draft.attachment.name}{" "}
                      <button
                        type="button"
                        className="font-semibold text-rose-700"
                        onClick={() => updateDraft(request.id, { attachment: null })}
                      >
                        Retirer
                      </button>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void treatRequest(request.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Marquer comme traitée
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {recent.length > 0 ? (
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Demandes traitées ({recent.length})
          </summary>
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {recent.map((request) => (
              <li key={request.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  {request.subject}{" "}
                  <span className="font-normal text-slate-500">— {request.memberName}</span>
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
  );
}
