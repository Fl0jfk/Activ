"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { StatusMessage, type Feedback } from "@/components/bureau-ui";
import { fetchJson } from "@/lib/fetch-json";

type TokenInfo = {
  label: string;
  expiresAt: string;
};

type TokenState =
  | { status: "missing" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; info: TokenInfo };

/** Même limite que le serveur (5 Mo). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const ACCEPT_ATTRIBUTE = [...ACCEPTED_EXTENSIONS, "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].join(",");

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

function checkFile(file: File): string {
  if (file.size === 0) return "Ce fichier est vide. Choisissez un autre fichier.";
  if (file.size > MAX_FILE_BYTES) {
    return `Ce fichier est trop volumineux (${formatSize(file.size)}). La taille maximale est de 5 Mo.`;
  }
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "Ce format n’est pas accepté. Envoyez un PDF ou une photo (JPEG, PNG, WebP ou HEIC).";
  }
  return "";
}

export default function PublicDocumentUploadForm({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [tokenState, setTokenState] = useState<TokenState>(token ? { status: "loading" } : { status: "missing" });
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const focusFeedback = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchJson<TokenInfo>(`/api/public-document-upload?token=${encodeURIComponent(token)}`);
      if (cancelled) return;
      if (result.ok && result.data) {
        setTokenState({ status: "ready", info: { label: result.data.label, expiresAt: result.data.expiresAt } });
      } else {
        setTokenState({ status: "error", message: result.message || "Ce lien n’est pas valide." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!focusFeedback.current) return;
    focusFeedback.current = false;
    feedbackRef.current?.focus();
    feedbackRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  });

  function handleFileChange(selected: File | null) {
    setFeedback(null);
    if (!selected) {
      setFile(null);
      setFileError("");
      return;
    }
    const problem = checkFile(selected);
    setFileError(problem);
    setFile(problem ? null : selected);
    if (problem && inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    if (!token || !file) {
      setFileError("Choisissez d’abord le fichier à envoyer.");
      inputRef.current?.focus();
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    const formData = new FormData();
    formData.append("token", token);
    formData.append("file", file);
    const result = await fetchJson("/api/public-document-upload", { method: "POST", body: formData });
    setIsLoading(false);
    if (result.ok) {
      setDone(true);
      setFile(null);
      setFeedback({ tone: "success", text: "Merci, votre document a bien été reçu. Vous n’avez rien d’autre à faire." });
    } else {
      setFeedback({
        tone: "error",
        text: result.message || "Le document n’a pas pu être envoyé. Réessayez dans un instant.",
      });
    }
    focusFeedback.current = true;
  }

  const expiryLabel =
    tokenState.status === "ready"
      ? new Date(tokenState.info.expiresAt).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="panel p-5 sm:p-8">
        <span className="eyebrow">Votre dossier</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Dépôt de pièce jointe</h1>

        {tokenState.status === "loading" ? (
          <p role="status" className="mt-4 text-[15px] font-semibold text-slate-700">
            Vérification du lien…
          </p>
        ) : null}

        {tokenState.status === "missing" || tokenState.status === "error" ? (
          <div className="mt-4 space-y-4">
            <StatusMessage
              feedback={{
                tone: "error",
                text: tokenState.status === "missing" ? "Ce lien est incomplet." : tokenState.message,
              }}
            />
            <p className="text-[15px] leading-6 text-slate-700">
              Si votre lien a expiré ou a déjà servi, demandez-en un nouveau au bureau de l’association.
            </p>
            <Link href="/contact" className="btn btn-primary">
              Contacter le bureau
            </Link>
          </div>
        ) : null}

        {tokenState.status === "ready" ? (
          <>
            <p className="mt-3 text-[15px] leading-6 text-slate-700">
              L’association vous demande de déposer&nbsp;: <strong>{tokenState.info.label}</strong>
            </p>
            {expiryLabel && !done ? (
              <p className="mt-1 text-sm text-slate-600">Ce lien est valable jusqu’au {expiryLabel}.</p>
            ) : null}

            <div
              ref={feedbackRef}
              tabIndex={-1}
              className={`focus:outline-none ${feedback ? "mt-5" : ""}`}
            >
              <StatusMessage feedback={feedback} />
            </div>

            {done ? (
              <div className="mt-5">
                <Link href="/" className="btn btn-primary">
                  Retour à l’accueil
                </Link>
              </div>
            ) : (
              <form noValidate onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-5">
                <div>
                  <label htmlFor={inputId} className="field-label">
                    Choisissez votre fichier
                  </label>
                  <p id={`${inputId}-hint`} className="mt-0.5 text-sm text-slate-600">
                    PDF ou photo (JPEG, PNG, WebP, HEIC) — 5 Mo au maximum. Sur téléphone, vous pouvez prendre la photo
                    directement.
                  </p>
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                    aria-invalid={fileError ? true : undefined}
                    aria-describedby={`${inputId}-hint${fileError ? ` ${inputId}-error` : ""}`}
                    disabled={isLoading}
                    className="field file:mr-3 file:rounded-full file:border-0 file:bg-brand-blue file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
                  />
                  {fileError ? (
                    <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm font-semibold text-rose-700">
                      {fileError}
                    </p>
                  ) : null}
                  {file ? (
                    <p className="mt-2 rounded-xl bg-brand-cream px-4 py-2.5 text-[15px] text-slate-800 ring-1 ring-brand-line">
                      <span className="font-bold break-all">{file.name}</span> — {formatSize(file.size)}
                    </p>
                  ) : null}
                </div>
                <button type="submit" disabled={isLoading || !file} aria-busy={isLoading || undefined} className="btn btn-primary w-full sm:w-auto">
                  {isLoading ? "Envoi en cours…" : "Envoyer le document"}
                </button>
              </form>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
