"use client";

import { FormEvent, useEffect, useState } from "react";

type TokenInfo = {
  label: string;
  expiresAt: string;
};

export default function PublicDocumentUploadForm({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [isLoadingToken, setIsLoadingToken] = useState(Boolean(token));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError("Lien invalide ou incomplet.");
      setIsLoadingToken(false);
      return;
    }

    let cancelled = false;
    async function loadToken() {
      setIsLoadingToken(true);
      setTokenError("");
      const response = await fetch(`/api/public-document-upload?token=${encodeURIComponent(token)}`);
      const payload = (await response.json()) as TokenInfo & { message?: string };
      if (cancelled) return;
      if (!response.ok) {
        setTokenError(payload.message ?? "Lien invalide.");
        setTokenInfo(null);
      } else {
        setTokenInfo({ label: payload.label, expiresAt: payload.expiresAt });
      }
      setIsLoadingToken(false);
    }
    void loadToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !file) {
      setMessage("Lien invalide ou fichier manquant.");
      return;
    }
    setIsLoading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("token", token);
    formData.append("file", file);
    const response = await fetch("/api/public-document-upload", { method: "POST", body: formData });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Document envoye." : "Erreur."));
    setIsLoading(false);
    if (response.ok) {
      setFile(null);
    }
  }

  const expiryLabel = tokenInfo
    ? new Date(tokenInfo.expiresAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
      <section className="panel p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">Dépôt de pièce jointe</h1>
        {isLoadingToken ? (
          <p className="mt-3 text-sm text-slate-600">Vérification du lien…</p>
        ) : tokenError ? (
          <p className="mt-3 text-sm font-medium text-rose-700">{tokenError}</p>
        ) : tokenInfo ? (
          <>
            <p className="mt-2 text-slate-700">
              L&apos;association vous demande de déposer&nbsp;:{" "}
              <strong>{tokenInfo.label}</strong>
            </p>
            {expiryLabel ? (
              <p className="mt-1 text-sm text-slate-500">Lien valide jusqu&apos;au {expiryLabel}.</p>
            ) : null}
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Fichier (PDF, JPG, PNG ou WebP)
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="mt-1 w-full max-w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={isLoading || !file}
                className="rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isLoading ? "Envoi en cours…" : "Envoyer le document"}
              </button>
            </form>
          </>
        ) : null}
        {message ? (
          <p
            className={`mt-4 text-sm font-medium ${message.includes("recu") || message.includes("reçu") ? "text-emerald-700" : "text-slate-700"}`}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
