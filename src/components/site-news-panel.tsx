"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssociationData, SiteNewsItem } from "@/lib/site-data-types";
import { randomId } from "@/lib/ids";
import {
  ASSOCIATION_GENERAL_NEWS,
  NEWS_KIND_OPTIONS,
  emptySiteNewsItem,
  formatEventSchedule,
  newsKindLabel,
  resolveNewsDisciplineLabel,
  sortNewsByDateDesc,
} from "@/lib/site-news";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900";

function disciplineSelectValue(disciplineId: string | null): string {
  return disciplineId ?? ASSOCIATION_GENERAL_NEWS;
}

export default function SiteNewsPanel() {
  const [data, setData] = useState<AssociationData | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState<SiteNewsItem | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage("");
    const response = await fetch("/api/admin/site-data");
    if (!response.ok) {
      setStatusMessage("Impossible de charger les actualités.");
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as AssociationData;
    setData({ ...payload, news: payload.news ?? [] });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortedNews = useMemo(
    () => (data ? sortNewsByDateDesc(data.news) : []),
    [data]
  );

  function startCreate() {
    setDraft({ ...emptySiteNewsItem(), id: randomId("news") });
  }

  function startEdit(item: SiteNewsItem) {
    setDraft({ ...item });
  }

  function cancelEdit() {
    setDraft(null);
  }

  function updateDraft(patch: Partial<SiteNewsItem>) {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  function applyDraftLocally() {
    if (!data || !draft) return;
    if (!draft.title.trim() || !draft.date) {
      setStatusMessage("Le titre et la date sont obligatoires.");
      return;
    }

    const normalized: SiteNewsItem = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      disciplineId: draft.disciplineId || null,
    };

    const withoutDuplicate = data.news.filter((item) => item.id !== normalized.id);
    setData({ ...data, news: sortNewsByDateDesc([...withoutDuplicate, normalized]) });
    cancelEdit();
    setStatusMessage("Actualité prête — cliquez sur « Enregistrer sur le site » pour publier.");
  }

  function removeNews(item: SiteNewsItem) {
    if (!data) return;
    if (!window.confirm(`Supprimer l'actualité « ${item.title} » ?`)) return;
    setData({ ...data, news: data.news.filter((entry) => entry.id !== item.id) });
    if (draft?.id === item.id) cancelEdit();
    setStatusMessage("Actualité retirée — enregistrez pour appliquer sur le site public.");
  }

  async function saveNews() {
    if (!data) return;
    setIsLoading(true);
    setStatusMessage("");
    const response = await fetch("/api/admin/site-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      setStatusMessage("Enregistrement impossible.");
      setIsLoading(false);
      return;
    }
    setStatusMessage("Actualités enregistrées — visibles sur la page d'accueil.");
    setIsLoading(false);
    await loadData();
  }

  if (!data && isLoading) {
    return <p className="text-sm text-slate-600">Chargement des actualités…</p>;
  }

  if (!data) {
    return <p className="text-sm text-rose-600">{statusMessage || "Actualités indisponibles."}</p>;
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Actualités du site</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gérées uniquement ici. La discipline est optionnelle : choisissez « Association (général) » pour une
          actualité qui concerne tout le club.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startCreate}
          disabled={Boolean(draft)}
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
        >
          Ajouter une actualité
        </button>
      </div>

      {draft ? (
        <article className="mt-4 rounded-xl border border-orange-300 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">
            {sortedNews.some((item) => item.id === draft.id) ? "Modifier" : "Nouvelle"} actualité
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Discipline (optionnel)
              <select
                value={disciplineSelectValue(draft.disciplineId)}
                onChange={(event) =>
                  updateDraft({
                    disciplineId:
                      event.target.value === ASSOCIATION_GENERAL_NEWS ? null : event.target.value,
                  })
                }
                className={inputClass}
              >
                <option value={ASSOCIATION_GENERAL_NEWS}>Association (général)</option>
                {data.disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                    {!discipline.active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Type d&apos;événement
              <select
                value={draft.kind}
                onChange={(event) => updateDraft({ kind: event.target.value })}
                className={inputClass}
              >
                {NEWS_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Date
              <input
                type="date"
                value={draft.date}
                onChange={(event) => updateDraft({ date: event.target.value })}
                className={inputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Titre
              <input
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                className={inputClass}
                placeholder="Ex. Tournoi départemental, Portes ouvertes…"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Heure de début
              <input
                type="time"
                value={draft.startTime}
                onChange={(event) => updateDraft({ startTime: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Heure de fin
              <input
                type="time"
                value={draft.endTime}
                onChange={(event) => updateDraft({ endTime: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Lieu
              <input
                value={draft.location}
                onChange={(event) => updateDraft({ location: event.target.value })}
                className={inputClass}
                placeholder="Ex. Gymnase municipal, mairie…"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Description
              <textarea
                value={draft.description}
                onChange={(event) => updateDraft({ description: event.target.value })}
                className={inputClass}
                rows={3}
                placeholder="Détails pratiques, inscription, public visé…"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyDraftLocally}
              className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Valider le formulaire
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Annuler
            </button>
          </div>
        </article>
      ) : null}

      <ul className="mt-4 space-y-3">
        {sortedNews.length > 0 ? (
          sortedNews.map((item) => (
            <li key={item.id} className="rounded-xl border border-orange-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-orange-700">
                    {newsKindLabel(item.kind)} · {resolveNewsDisciplineLabel(item.disciplineId, data.disciplines)}
                  </p>
                  <h3 className="mt-0.5 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{formatEventSchedule(item)}</p>
                  {item.location ? (
                    <p className="mt-1 text-sm text-slate-600">Lieu : {item.location}</p>
                  ) : null}
                  {item.description ? (
                    <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNews(item)}
                    className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="rounded-xl border border-dashed border-orange-200 bg-white/70 p-4 text-sm text-slate-600">
            Aucune actualité publiée pour le moment.
          </li>
        )}
      </ul>

      <button
        type="button"
        disabled={isLoading || Boolean(draft)}
        onClick={() => void saveNews()}
        className="mt-4 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Enregistrer sur le site
      </button>
      {statusMessage ? <p className="mt-2 text-sm text-slate-600">{statusMessage}</p> : null}
    </section>
  );
}
