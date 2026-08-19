"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssociationData, SiteNewsItem, SitePoll } from "@/lib/site-data-types";
import { randomId } from "@/lib/ids";
import SiteImageField from "@/components/site-image-field";
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

type PollDraft = {
  id: string | null;
  question: string;
  options: string[];
};

function disciplineSelectValue(disciplineId: string | null): string {
  return disciplineId ?? ASSOCIATION_GENERAL_NEWS;
}

function emptyPollDraft(): PollDraft {
  return { id: null, question: "", options: ["", ""] };
}

export default function SiteNewsPanel() {
  const [data, setData] = useState<AssociationData | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<SiteNewsItem | null>(null);
  const [pollDraft, setPollDraft] = useState<PollDraft>({
    id: null,
    question: "",
    options: ["", ""],
  });

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

  const persistSiteData = useCallback(
    async (nextData: AssociationData, successMessage: string): Promise<boolean> => {
      setIsSaving(true);
      setStatusMessage("");
      const response = await fetch("/api/admin/site-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextData),
      });
      if (!response.ok) {
        setStatusMessage("Enregistrement impossible. Réessayez dans un instant.");
        setIsSaving(false);
        return false;
      }
      setData(nextData);
      setStatusMessage(successMessage);
      setIsSaving(false);
      return true;
    },
    []
  );

  function startCreate() {
    setDraft({ ...emptySiteNewsItem(), id: randomId("news") });
    setPollDraft(emptyPollDraft());
    setStatusMessage("");
  }

  function startEdit(item: SiteNewsItem) {
    setDraft({
      ...item,
      ctaLabel:
        item.ctaLabel?.trim() || (item.kind === "sondage" ? "Donner son avis" : "Lire la suite"),
    });
    const linked = data?.polls.find((poll) => poll.newsId === item.id) ?? null;
    setPollDraft(
      linked
        ? { id: linked.id, question: linked.question, options: linked.options.map((option) => option.label) }
        : emptyPollDraft(),
    );
    setStatusMessage("");
  }

  function cancelEdit() {
    setDraft(null);
    setPollDraft(emptyPollDraft());
  }

  function updateDraft(patch: Partial<SiteNewsItem>) {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  function updatePollDraft(patch: Partial<PollDraft>) {
    setPollDraft((previous) => ({ ...previous, ...patch }));
  }

  async function uploadGalleryFiles(files: FileList | null) {
    if (!draft || !files || files.length === 0) return;
    setIsSaving(true);
    setStatusMessage("");
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/admin/site-image", {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as { url?: string; message?: string };
        if (!response.ok || !payload.url) {
          throw new Error(payload.message ?? "Envoi impossible.");
        }
        uploadedUrls.push(payload.url);
      }
      updateDraft({
        galleryImages: [...(draft.galleryImages ?? []), ...uploadedUrls],
      });
      setStatusMessage(`${uploadedUrls.length} photo(s) ajoutée(s) à la galerie.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  function removeGalleryImage(url: string) {
    if (!draft) return;
    updateDraft({
      galleryImages: (draft.galleryImages ?? []).filter((entry) => entry !== url),
    });
  }

  function buildNextDataWithDraft(): AssociationData | null {
    if (!data || !draft) return null;
    if (!draft.title.trim() || !draft.date) {
      setStatusMessage("Le titre et la date sont obligatoires.");
      return null;
    }

    const normalized: SiteNewsItem = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location.trim(),
      disciplineId: draft.disciplineId || null,
      ctaLabel: draft.ctaLabel?.trim() || "Lire la suite",
      imageUrl: draft.imageUrl?.trim() ?? "",
      galleryImages: Array.isArray(draft.galleryImages) ? draft.galleryImages : [],
    };

    const isPollNews = normalized.kind === "sondage";
    const pollQuestion = pollDraft.question.trim();
    const pollOptions = pollDraft.options.map((option) => option.trim()).filter(Boolean);
    if (isPollNews) {
      if (!pollQuestion) {
        setStatusMessage("Ajoutez la question du sondage.");
        return null;
      }
      if (pollOptions.length < 2) {
        setStatusMessage("Ajoutez au moins deux réponses au sondage.");
        return null;
      }
    }

    const withoutDuplicate = data.news.filter((item) => item.id !== normalized.id);
    const nextPolls = data.polls.filter(
      (poll) => (poll.newsId === normalized.id ? isPollNews : true),
    );
    if (isPollNews) {
      const existingPoll = pollDraft.id ? data.polls.find((poll) => poll.id === pollDraft.id) : undefined;
      const options = pollOptions.map((label, index) => ({
        id: existingPoll?.options[index]?.id ?? randomId("opt"),
        label,
        votes: existingPoll?.options[index]?.votes ?? 0,
      }));
      const nextPoll: SitePoll = {
        id: existingPoll?.id ?? randomId("poll"),
        question: pollQuestion,
        options,
        newsId: normalized.id,
        status: existingPoll?.status ?? "open",
        createdAt: existingPoll?.createdAt ?? new Date().toISOString(),
        closedAt: existingPoll?.closedAt ?? null,
        voterHashes: existingPoll?.voterHashes ?? [],
      };
      nextPolls.unshift(nextPoll);
    }
    return {
      ...data,
      news: sortNewsByDateDesc([...withoutDuplicate, normalized]),
      polls: nextPolls,
    };
  }

  async function applyDraft() {
    const nextData = buildNextDataWithDraft();
    if (!nextData) return;
    const isEdit = data?.news.some((item) => item.id === draft?.id);
    const saved = await persistSiteData(
      nextData,
      isEdit ? "Actualité mise à jour sur le site." : "Actualité publiée sur le site."
    );
    if (saved) cancelEdit();
  }

  async function removeNews(item: SiteNewsItem) {
    if (!data) return;
    if (!window.confirm(`Supprimer l'actualité « ${item.title} » ?`)) return;
    const nextData = {
      ...data,
      news: data.news.filter((entry) => entry.id !== item.id),
      polls: data.polls.map((poll) => (poll.newsId === item.id ? { ...poll, newsId: null } : poll)),
    };
    const saved = await persistSiteData(nextData, "Actualité supprimée du site.");
    if (saved && draft?.id === item.id) cancelEdit();
  }

  if (!data && isLoading) {
    return <p className="text-sm text-slate-600">Chargement des actualités…</p>;
  }

  if (!data) {
    return <p className="text-sm text-rose-600">{statusMessage || "Actualités indisponibles."}</p>;
  }

  const busy = isLoading || isSaving;
  const editingNewsId = draft && data.news.some((item) => item.id === draft.id) ? draft.id : null;

  return (
    <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Actualités du site</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gérées uniquement ici. Chaque validation ou suppression est enregistrée automatiquement sur le site
          public. La discipline est optionnelle : choisissez « Association (général) » pour une actualité qui
          concerne tout le club.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startCreate}
          disabled={busy || Boolean(draft)}
          className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
        >
          Ajouter une actualité
        </button>
      </div>

      {draft ? (
        <article className="mt-4 rounded-xl border-2 border-cyan-400 bg-cyan-50/40 p-4 shadow-sm">
          <p className="rounded-lg bg-cyan-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Édition en cours
          </p>
          <h3 className="mt-3 text-base font-semibold text-slate-900">
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
                disabled={busy}
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
                onChange={(event) => {
                  const nextKind = event.target.value;
                  updateDraft({
                    kind: nextKind,
                    ctaLabel: nextKind === "sondage" ? "Donner son avis" : draft.ctaLabel,
                  });
                  if (nextKind === "sondage" && !pollDraft.question.trim()) {
                    setPollDraft(emptyPollDraft());
                  }
                }}
                disabled={busy}
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
                disabled={busy}
                className={inputClass}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Titre
              <input
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.target.value })}
                disabled={busy}
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
                disabled={busy}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Heure de fin
              <input
                type="time"
                value={draft.endTime}
                onChange={(event) => updateDraft({ endTime: event.target.value })}
                disabled={busy}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Lieu
              <input
                value={draft.location}
                onChange={(event) => updateDraft({ location: event.target.value })}
                disabled={busy}
                className={inputClass}
                placeholder="Ex. Gymnase municipal, mairie…"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Description
              <textarea
                value={draft.description}
                onChange={(event) => updateDraft({ description: event.target.value })}
                disabled={busy}
                className={inputClass}
                rows={Math.max(6, draft.description.split("\n").length + 2)}
                placeholder="Détails pratiques, inscription, public visé…"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Texte du bouton (carte accueil)
              <input
                value={draft.ctaLabel ?? "Lire la suite"}
                onChange={(event) => updateDraft({ ctaLabel: event.target.value })}
                disabled={busy}
                className={inputClass}
                placeholder="Ex. Donner son avis, Cliquer pour voter…"
              />
            </label>
            {draft.kind === "sondage" ? (
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 sm:col-span-2">
                <p className="text-sm font-semibold text-violet-900">Sondage lié à cette actualité</p>
                <label className="mt-2 flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Question du sondage
                  <input
                    value={pollDraft.question}
                    onChange={(event) => updatePollDraft({ question: event.target.value })}
                    disabled={busy}
                    className={inputClass}
                    placeholder="Ex. Cette activité vous intéresse ?"
                  />
                </label>
                <div className="mt-2 space-y-2">
                  {pollDraft.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={option}
                        onChange={(event) => {
                          const next = [...pollDraft.options];
                          next[index] = event.target.value;
                          updatePollDraft({ options: next });
                        }}
                        disabled={busy}
                        className={inputClass}
                        placeholder={`Réponse ${index + 1}`}
                      />
                      {pollDraft.options.length > 2 ? (
                        <button
                          type="button"
                          onClick={() =>
                            updatePollDraft({
                              options: pollDraft.options.filter((_, optionIndex) => optionIndex !== index),
                            })
                          }
                          disabled={busy}
                          className="shrink-0 rounded-lg border border-slate-300 px-2 text-sm font-semibold text-slate-600"
                          aria-label="Retirer cette réponse"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {pollDraft.options.length < 8 ? (
                    <button
                      type="button"
                      onClick={() => updatePollDraft({ options: [...pollDraft.options, ""] })}
                      disabled={busy}
                      className="text-sm font-semibold text-violet-800 disabled:opacity-50"
                    >
                      + Ajouter une réponse
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <SiteImageField
              label="Photo principale"
              helpText="Affichée sur l'accueil et en tête de l'article."
              value={draft.imageUrl}
              onChange={(imageUrl) => updateDraft({ imageUrl })}
              disabled={busy}
              emptyValue=""
            />
            <div className="flex flex-col gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
              <span>Galerie (photos supplémentaires)</span>
              <p className="text-xs font-normal text-slate-500">
                Visibles uniquement sur la page de l&apos;actualité, pas sur l&apos;accueil.
              </p>
              {(draft.galleryImages ?? []).length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(draft.galleryImages ?? []).map((url) => (
                    <div key={url} className="relative overflow-hidden rounded-xl border border-slate-200">
                      <Image
                        src={url}
                        alt=""
                        width={240}
                        height={160}
                        unoptimized
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeGalleryImage(url)}
                        disabled={busy}
                        className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-rose-700 disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-normal text-slate-500">Aucune photo de galerie pour le moment.</p>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                disabled={busy}
                onChange={(event) => {
                  void uploadGalleryFiles(event.target.files);
                  event.target.value = "";
                }}
                className="block w-full max-w-md text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-50"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void applyDraft()}
              disabled={busy}
              className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:py-2"
            >
              {isSaving ? "Enregistrement…" : "Enregistrer l'actualité"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={busy}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 sm:py-2"
            >
              Annuler
            </button>
          </div>
        </article>
      ) : null}

      <ul className="mt-4 space-y-3">
        {sortedNews.length > 0 ? (
          sortedNews.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border bg-white p-4 transition ${
                editingNewsId === item.id
                  ? "scale-[1.01] border-cyan-400 shadow-md ring-2 ring-cyan-200"
                  : "border-orange-200"
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={96}
                      height={72}
                      unoptimized
                      className="h-16 w-24 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {editingNewsId === item.id ? (
                      <p className="mb-1 inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                        Vous modifiez cette actualité
                      </p>
                    ) : null}
                    <p className="text-xs font-semibold uppercase text-orange-700">
                      {newsKindLabel(item.kind)} ·{" "}
                      {resolveNewsDisciplineLabel(item.disciplineId, data.disciplines)}
                    </p>
                    <h3 className="mt-0.5 font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-700">{formatEventSchedule(item)}</p>
                    {item.location ? (
                      <p className="mt-1 text-sm text-slate-600">Lieu : {item.location}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs font-semibold text-orange-800">
                      Bouton : {item.ctaLabel?.trim() || "Lire la suite"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    disabled={busy}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 sm:py-1 sm:text-xs"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeNews(item)}
                    disabled={busy}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50 sm:py-1 sm:text-xs"
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

      {statusMessage ? (
        <p className={`mt-3 text-sm ${statusMessage.includes("impossible") ? "text-rose-600" : "text-slate-600"}`}>
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
