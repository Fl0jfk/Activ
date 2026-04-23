"use client";

import { FormEvent, useState } from "react";

export default function PublicDocumentUploadForm({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !file) {
      setMessage("Lien invalide ou fichier manquant.");
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("token", token);
    formData.append("file", file);
    const response = await fetch("/api/public-document-upload", { method: "POST", body: formData });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Document envoye." : "Erreur."));
    setIsLoading(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Depot de piece jointe</h1>
        <p className="mt-2 text-slate-700">Depose ici le document demande par l&apos;association.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            required
          />
          <button
            type="submit"
            disabled={isLoading || !file || !token}
            className="rounded-xl bg-cyan-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            Envoyer le document
          </button>
        </form>
        {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
      </section>
    </main>
  );
}
