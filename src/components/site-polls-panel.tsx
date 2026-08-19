"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { SiteNewsItem, SitePoll } from "@/lib/site-data-types";
import { sortNewsByDateDesc } from "@/lib/site-news";
import { pollVoteTotal } from "@/lib/site-polls";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900";

export default function SitePollsPanel() {
  const [polls, setPolls] = useState<SitePoll[]>([]);
  const [newsItems, setNewsItems] = useState<SiteNewsItem[]>([]);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [newsId, setNewsId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/admin/site-data");
    if (!response.ok) {
      setStatusMessage("Impossible de charger les sondages.");
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as { polls?: SitePoll[]; news?: SiteNewsItem[] };
    setPolls(payload.polls ?? []);
    setNewsItems(sortNewsByDateDesc(payload.news ?? []));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPoll(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage("");
    const response = await fetch("/api/admin/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, options, newsId: newsId || null }),
    });
    const payload = (await response.json()) as { message?: string };
    setStatusMessage(payload.message ?? (response.ok ? "Sondage publié." : "Erreur."));
    setIsSaving(false);
    if (response.ok) {
      setQuestion("");
      setOptions(["", ""]);
      setNewsId("");
      await load();
    }
  }

  async function updatePoll(pollId: string, action: "close" | "open" | "delete") {
    if (action === "delete" && !window.confirm("Supprimer ce sondage et ses votes ?")) {
      return;
    }
    setIsSaving(true);
    setStatusMessage("");
    const response = await fetch(`/api/admin/polls/${pollId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json()) as { message?: string };
    setStatusMessage(payload.message ?? (response.ok ? "OK" : "Erreur."));
    setIsSaving(false);
    if (response.ok) await load();
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Sondages du site</h2>
      <p className="mt-1 text-sm text-slate-600">
        Publiez un sondage indépendant sur l&apos;accueil ou liez-le à une actualité précise. Vous
        pouvez l&apos;arrêter à tout moment : les votes restent visibles, sans nouveaux votes.
      </p>

      <form onSubmit={(event) => void createPoll(event)} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Question
          <input
            className={`${inputClass} mt-1`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ex. Quel créneau préférez-vous pour le yoga ?"
            disabled={isSaving}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Lier à une actualité (optionnel)
          <select
            className={`${inputClass} mt-1`}
            value={newsId}
            onChange={(event) => setNewsId(event.target.value)}
            disabled={isSaving}
          >
            <option value="">Aucune (sondage indépendant)</option>
            {newsItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Réponses</p>
          {options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                className={inputClass}
                value={option}
                onChange={(event) => {
                  const next = [...options];
                  next[index] = event.target.value;
                  setOptions(next);
                }}
                placeholder={`Réponse ${index + 1}`}
                disabled={isSaving}
                required={index < 2}
              />
              {options.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, optionIndex) => optionIndex !== index))}
                  className="shrink-0 rounded-lg border border-slate-300 px-2 text-sm font-semibold text-slate-600"
                  aria-label="Retirer cette réponse"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {options.length < 8 ? (
            <button
              type="button"
              onClick={() => setOptions([...options, ""])}
              className="text-sm font-semibold text-violet-800"
            >
              + Ajouter une réponse
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Publier le sondage
        </button>
      </form>

      {statusMessage ? (
        <p className="mt-3 text-sm text-slate-700" role="status">
          {statusMessage}
        </p>
      ) : null}
      {isLoading ? <p className="mt-3 text-sm text-slate-500">Chargement…</p> : null}

      <ul className="mt-4 space-y-3">
        {polls.map((poll) => {
          const total = pollVoteTotal(poll);
          return (
            <li key={poll.id} className="rounded-xl border border-violet-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-violet-800">
                    {poll.status === "open" ? "En cours" : "Arrêté"}
                  </p>
                  <h3 className="mt-0.5 font-semibold text-slate-900">{poll.question}</h3>
                  {poll.newsId ? (
                    <p className="mt-1 text-xs font-medium text-violet-700">
                      Lié à : {newsItems.find((item) => item.id === poll.newsId)?.title ?? "actualité supprimée"}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">{total} vote{total > 1 ? "s" : ""}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  {poll.status === "open" ? (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void updatePoll(poll.id, "close")}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50 sm:text-xs"
                    >
                      Arrêter
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void updatePoll(poll.id, "open")}
                      className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50 sm:text-xs"
                    >
                      Relancer
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void updatePoll(poll.id, "delete")}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50 sm:text-xs"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {poll.options.map((option) => {
                  const percent = total > 0 ? Math.round((option.votes / total) * 100) : 0;
                  return (
                    <li key={option.id}>
                      <div className="flex justify-between text-sm text-slate-700">
                        <span>{option.label}</span>
                        <span className="font-semibold">
                          {option.votes} · {percent} %
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
