"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import type { MemberRequest, MemberRequestDocument } from "@/lib/club-data";
import {
  MEMBER_REQUEST_STATUS_LABELS,
  memberRequestStatusBadgeClass,
  sortMemberRequestsDesc,
} from "@/lib/member-request";

export default function MemberRequestsSection() {
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<MemberRequestDocument | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/club/member-requests");
    if (!response.ok) {
      setStatusMessage("Impossible de charger vos demandes.");
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as { mine?: MemberRequest[] };
    setRequests(sortMemberRequestsDesc(payload.mine ?? []));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setStatusMessage("");
    try {
      const uploaded = await uploadDocument(file);
      setAttachment(uploaded);
      setStatusMessage("Pièce jointe ajoutée.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Erreur d'upload.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/club/member-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, attachment }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Envoi impossible.");
      }
      setSubject("");
      setMessage("");
      setAttachment(null);
      setStatusMessage(payload.message ?? "Demande envoyée.");
      await load();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel p-6">
      <h2 className="text-xl font-bold text-slate-900">Demandes au bureau</h2>
      <p className="mt-1 text-sm text-slate-600">
        Posez une question ou une demande au bureau. Vous serez notifié quand elle sera traitée.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Objet
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            placeholder="Ex. Attestation, question licence…"
            maxLength={120}
            required
            disabled={isSaving}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
            rows={4}
            placeholder="Décrivez votre demande…"
            required
            disabled={isSaving}
          />
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Pièce jointe (optionnel)
            <input
              type="file"
              onChange={(event) => void handleFileChange(event)}
              disabled={isSaving || isUploading}
              className="mt-1 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>
          {attachment ? (
            <p className="mt-1 text-xs text-slate-600">
              Fichier prêt : {attachment.name}{" "}
              <button
                type="button"
                className="font-semibold text-rose-700"
                onClick={() => setAttachment(null)}
                disabled={isSaving}
              >
                Retirer
              </button>
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isSaving ? "Envoi…" : "Envoyer la demande"}
        </button>
      </form>

      {statusMessage ? (
        <p className="mt-3 text-sm text-slate-700" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Vos demandes</h3>
        {isLoading ? <p className="text-sm text-slate-500">Chargement…</p> : null}
        {!isLoading && requests.length === 0 ? (
          <p className="text-sm text-slate-600">Aucune demande pour le moment.</p>
        ) : null}
        {requests.map((request) => (
          <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">{request.subject}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${memberRequestStatusBadgeClass(request.status)}`}
              >
                {MEMBER_REQUEST_STATUS_LABELS[request.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Envoyée le{" "}
              {new Date(request.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{request.message}</p>
            {request.attachment ? (
              <p className="mt-2 text-sm">
                <a
                  href={`/api/club/member-requests/${request.id}/file?which=member`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cyan-800 underline"
                >
                  Voir ma pièce jointe ({request.attachment.name})
                </a>
              </p>
            ) : null}
            {request.status === "treated" && request.bureauReply ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <p className="font-semibold">Réponse du bureau</p>
                <p className="mt-1 whitespace-pre-wrap">{request.bureauReply}</p>
                {request.bureauAttachment ? (
                  <a
                    href={`/api/club/member-requests/${request.id}/file?which=bureau`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-semibold text-emerald-900 underline"
                  >
                    Pièce jointe du bureau ({request.bureauAttachment.name})
                  </a>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
