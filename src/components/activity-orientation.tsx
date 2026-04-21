"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Discipline } from "@/lib/site-data";

type ActivityOrientationProps = {
  disciplines: Discipline[];
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

export default function ActivityOrientation({ disciplines }: ActivityOrientationProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Salut, je suis l'assistant Activ'. Tu cherches plutot une activite sportive ou culturelle ?",
    },
  ]);

  const availableDisciplines = useMemo(
    () => disciplines.filter((discipline) => discipline.active),
    [disciplines]
  );

  function getSuggestion(prompt: string): Discipline | null {
    const normalizedPrompt = prompt.toLowerCase();

    const discipline = availableDisciplines.find((item) => {
      const text = `${item.name} ${item.description}`.toLowerCase();

      if (
        normalizedPrompt.includes("doux") ||
        normalizedPrompt.includes("souple") ||
        normalizedPrompt.includes("zen")
      ) {
        return text.includes("yoga") || text.includes("pilates");
      }
      if (
        normalizedPrompt.includes("cardio") ||
        normalizedPrompt.includes("intense") ||
        normalizedPrompt.includes("energie")
      ) {
        return text.includes("cardio") || text.includes("renforcement");
      }
      if (normalizedPrompt.includes("dos") || normalizedPrompt.includes("posture")) {
        return text.includes("pilates");
      }
      if (normalizedPrompt.includes("souplesse") || normalizedPrompt.includes("respiration")) {
        return text.includes("yoga");
      }
      if (normalizedPrompt.includes("debutant")) {
        return true;
      }
      return false;
    });

    return discipline ?? availableDisciplines[0] ?? null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) {
      return;
    }

    const suggestion = getSuggestion(prompt);
    const assistantReply = suggestion
      ? `Je te conseille de commencer par ${suggestion.name}. ${suggestion.description}`
      : "Je n'ai pas encore assez d'informations. Dis-moi si tu preferes quelque chose de doux, cardio, posture ou souplesse.";

    setMessages((previous) => [
      ...previous,
      { role: "user", content: prompt },
      { role: "assistant", content: assistantReply },
    ]);
    setInput("");
  }

  return (
    <section id="orientation" className="panel mt-8 p-6 sm:p-8">
      <h2 className="panel-title">Assistant d&apos;orientation Activ&apos;</h2>
      <p className="mt-2 text-slate-600">
        Version chatbot: ecris librement ce que tu recherches, et on te propose une activite.
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
            {message.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm"
          placeholder="Ex: Je veux reprendre doucement, j'ai mal au dos..."
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Envoyer
        </button>
      </form>

      <p className="mt-3 text-xs text-slate-500">
        Ensuite, on remplacera cette logique par Mistral pour un vrai dialogue intelligent.
      </p>
    </section>
  );
}
