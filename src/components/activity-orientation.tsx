"use client";

import { renderChatMessageContent } from "@/lib/chat-message-links";
import { FormEvent, useState } from "react";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

export default function ActivityOrientation() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Salut, je suis l'assistant Activ'. Dis-moi ce que tu recherches (détente, cardio, débutant, mal de dos...) et je te conseillerai une activité adaptée. Pour essayer une discipline, je vous orienterai vers une séance d'essai planifiée ou vers la [page contact](/contact).",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || isLoading) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: prompt }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orientation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      const payload = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Impossible de contacter l'assistant.");
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: payload.reply ?? "Je n'ai pas pu formuler une réponse." },
      ]);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Une erreur est survenue.";
      setError(message);
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "Désolé, je ne peux pas répondre pour le moment. Réessayez dans quelques instants ou [contactez l'association](/contact).",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section id="orientation" className="anchor-section panel mt-8 p-6 sm:p-8">
      <h2 className="panel-title">Assistant d&apos;orientation Activ&apos;</h2>
      <p className="mt-2 text-slate-600">
        Conseiller intelligent alimenté par Mistral, basé sur les activités actives et le planning de la semaine.
      </p>

      <div className="hide-scrollbar mt-5 max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              message.role === "assistant"
                ? "bg-gradient-to-r from-cyan-100 to-fuchsia-100 text-slate-800"
                : "ml-auto bg-slate-900 text-white"
            }`}
          >
            {renderChatMessageContent(message.content)}
          </div>
        ))}
        {isLoading ? (
          <p className="text-sm text-slate-500">L&apos;assistant réfléchit...</p>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isLoading}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-60"
          placeholder="Ex: Je veux reprendre doucement, j'ai mal au dos..."
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isLoading ? "..." : "Envoyer"}
        </button>
      </form>
    </section>
  );
}
