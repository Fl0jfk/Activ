"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { renderRichTextContent } from "@/lib/chat-message-links";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type Suggestion = { label: string; prompt: string };

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: "Reprendre doucement", prompt: "Je souhaite reprendre une activité en douceur. Que me conseillez-vous ?" },
  { label: "Mal de dos", prompt: "J'ai mal au dos. Quelle activité me conseillez-vous ?" },
  { label: "Cardio", prompt: "Je cherche une activité qui fasse travailler le cardio." },
  { label: "Débutant", prompt: "Je suis débutant(e). Par quelle activité commencer ?" },
];

const GREETING =
  "Bonjour ! Dites-moi ce que vous recherchez (détente, cardio, débutant, mal de dos…) et je vous conseillerai une activité adaptée. Pour essayer une discipline, je vous orienterai vers une séance d'essai planifiée ou vers la [page contact](/contact).";

type OrientationAssistantProps = {
  variant?: "strip" | "button";
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  /** Pré-remplit des suggestions adaptées au contexte (ex. une discipline). */
  suggestions?: Suggestion[];
  className?: string;
};

export default function OrientationAssistant({
  variant = "strip",
  title = "Vous ne savez pas quel cours choisir ?",
  subtitle = "Décrivez-nous vos envies, notre assistant vous conseille.",
  buttonLabel = "Poser une question",
  suggestions = DEFAULT_SUGGESTIONS,
  className = "",
}: OrientationAssistantProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: GREETING }]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages, isLoading]);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function ask(prompt: string) {
    const text = prompt.trim();
    if (!text || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/orientation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      const reply = response.ok
        ? (payload.reply ?? "Je n'ai pas pu formuler une réponse.")
        : (payload.error ??
          "Désolé, je ne peux pas répondre pour le moment. Réessayez dans quelques instants ou [contactez l'association](/contact).");
      setMessages((previous) => [...previous, { role: "assistant", content: reply }]);
    } catch {
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  const hasUserMessage = messages.some((message) => message.role === "user");

  return (
    <>
      {variant === "strip" ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-brand-blue/20 bg-gradient-to-r from-brand-blue/10 to-brand-green/12 px-5 py-4 sm:px-6 ${className}`}
        >
          <div>
            <p className="font-bold text-slate-900">{title}</p>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
          <button type="button" onClick={openDialog} className="btn btn-primary btn-sm">
            {buttonLabel}
          </button>
        </div>
      ) : (
        <button type="button" onClick={openDialog} className={`btn btn-outline btn-sm ${className}`}>
          {buttonLabel}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-label="Assistant Activ'"
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
        className="m-auto w-[min(440px,94vw)] overflow-hidden rounded-3xl border-0 p-0 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)] backdrop:bg-slate-900/50 backdrop:backdrop-blur-[2px]"
      >
        <div className="flex items-center justify-between bg-brand-blue px-5 py-4 text-white">
          <div>
            <p className="text-[17px] font-bold">Assistant Activ&apos;</p>
            <p className="text-[13px] text-white/85">Trouvez le cours qui vous correspond</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg text-white hover:bg-white/30"
          >
            ×
          </button>
        </div>

        <div
          ref={chatRef}
          aria-live="polite"
          className="flex max-h-[min(320px,45vh)] min-h-[160px] flex-col gap-2.5 overflow-y-auto bg-brand-cream px-5 py-4"
        >
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                message.role === "assistant"
                  ? "rounded-tl-sm border border-brand-line bg-white text-slate-800"
                  : "ml-auto rounded-tr-sm bg-brand-blue text-white"
              }`}
            >
              {message.role === "assistant" ? renderRichTextContent(message.content) : message.content}
            </div>
          ))}
          {isLoading ? <p className="text-sm text-slate-500">L&apos;assistant réfléchit…</p> : null}
        </div>

        {!hasUserMessage ? (
          <div className="flex flex-wrap gap-2 px-5 pt-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => void ask(suggestion.prompt)}
                className="rounded-full border-[1.5px] border-brand-blue bg-white px-3.5 py-1.5 text-[13.5px] font-semibold text-brand-blue hover:bg-brand-blue/10"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex gap-2 px-5 pb-5 pt-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isLoading}
            maxLength={500}
            aria-label="Votre question"
            className="min-w-0 flex-1 rounded-full border-[1.5px] border-brand-line bg-white px-4 py-2.5 text-sm disabled:opacity-60"
            placeholder="Écrivez votre question…"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="btn btn-primary btn-sm disabled:opacity-60">
            {isLoading ? "…" : "Envoyer"}
          </button>
        </form>
      </dialog>
    </>
  );
}
