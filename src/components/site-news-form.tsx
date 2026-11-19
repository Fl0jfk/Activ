"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog, StatusMessage, type Feedback } from "@/components/bureau-ui";
import SiteImage from "@/components/site-image";
import SiteImageField from "@/components/site-image-field";
import { Collapsible } from "@/components/site-content-ui";
import { uploadSiteImage } from "@/lib/client-image-upload";
import { randomId } from "@/lib/ids";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from "@/lib/site-polls";
import { ASSOCIATION_GENERAL_NEWS, NEWS_KIND_OPTIONS } from "@/lib/site-news";
import type { Discipline, SiteNewsItem, SitePoll } from "@/lib/site-data-types";

export type PollDraftOption = { id: string; label: string };
export type PollDraft = { id: string | null; question: string; options: PollDraftOption[] };

export function emptyPollDraft(): PollDraft {
  return {
    id: null,
    question: "",
    options: [
      { id: randomId("opt"), label: "" },
      { id: randomId("opt"), label: "" },
    ],
  };
}

export function pollToDraft(poll: SitePoll): PollDraft {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options.map((option) => ({ id: option.id, label: option.label })),
  };
}

type NewsFormProps = {
  mode: "create" | "edit";
  value: SiteNewsItem;
  onChange: (patch: Partial<SiteNewsItem>) => void;
  onKindModeChange: (mode: "news" | "poll") => void;
  poll: PollDraft;
  onPollChange: (patch: Partial<PollDraft>) => void;
  /** Sondage déjà enregistré pour cette actualité (sert à afficher les votes reçus). */
  savedPoll: SitePoll | null;
  disciplines: Discipline[];
  busy: boolean;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  invalidTitle: boolean;
  invalidDate: boolean;
};

const CATEGORY_OPTIONS = NEWS_KIND_OPTIONS.filter((option) => option.value !== "sondage");

function voteLabel(count: number): string {
  return count === 0 ? "Aucun vote" : count === 1 ? "1 vote" : `${count} votes`;
}

export default function SiteNewsForm({
  mode,
  value,
  onChange,
  onKindModeChange,
  poll,
  onPollChange,
  savedPoll,
  disciplines,
  busy,
  moreOpen,
  onMoreOpenChange,
  invalidTitle,
  invalidDate,
}: NewsFormProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [galleryFeedback, setGalleryFeedback] = useState<Feedback>(null);
  const [optionToRemove, setOptionToRemove] = useState<number | null>(null);

  useEffect(() => {
    if (mode === "create") titleRef.current?.focus();
  }, [mode]);

  const isPoll = value.kind === "sondage";
  const disabled = busy || uploading;
  const savedVotes = (optionId: string) => savedPoll?.options.find((option) => option.id === optionId)?.votes ?? 0;
  const savedTotal = savedPoll ? savedPoll.options.reduce((sum, option) => sum + option.votes, 0) : 0;
  const gallery = value.galleryImages ?? [];

  async function uploadGalleryFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setGalleryFeedback(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadSiteImage(file));
      }
      onChange({ galleryImages: [...gallery, ...urls] });
      setGalleryFeedback({
        tone: "success",
        text: urls.length === 1 ? "1 photo ajoutée à la galerie." : `${urls.length} photos ajoutées à la galerie.`,
      });
    } catch (error) {
      setGalleryFeedback({ tone: "error", text: error instanceof Error ? error.message : "Envoi impossible." });
    } finally {
      setUploading(false);
    }
  }

  function updateOption(index: number, label: string) {
    onPollChange({
      options: poll.options.map((option, optionIndex) => (optionIndex === index ? { ...option, label } : option)),
    });
  }

  function removeOption(index: number) {
    onPollChange({ options: poll.options.filter((_, optionIndex) => optionIndex !== index) });
  }

  function requestRemoveOption(index: number) {
    const option = poll.options[index];
    if (option && savedVotes(option.id) > 0) {
      setOptionToRemove(index);
      return;
    }
    removeOption(index);
  }

  const removedOption = optionToRemove !== null ? poll.options[optionToRemove] : undefined;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label sm:col-span-2">
          Titre <span className="font-normal text-slate-600">(obligatoire)</span>
          <input
            ref={titleRef}
            value={value.title}
            onChange={(event) => onChange({ title: event.target.value })}
            disabled={busy}
            className={`field ${invalidTitle ? "border-rose-400" : ""}`}
            aria-invalid={invalidTitle}
            placeholder="Ex. Tournoi départemental, portes ouvertes…"
            maxLength={160}
          />
        </label>
        <label className="field-label">
          Date <span className="font-normal text-slate-600">(obligatoire)</span>
          <input
            type="date"
            value={value.date}
            onChange={(event) => onChange({ date: event.target.value })}
            disabled={busy}
            className={`field ${invalidDate ? "border-rose-400" : ""}`}
            aria-invalid={invalidDate}
          />
        </label>
        <div className="sm:col-span-2">
          <label className="field-label">
            Texte
            <textarea
              value={value.description}
              onChange={(event) => onChange({ description: event.target.value })}
              disabled={busy}
              className="field"
              rows={Math.min(14, Math.max(6, value.description.split("\n").length + 2))}
              placeholder="Détails pratiques, inscription, public concerné…"
            />
          </label>
          <p className="mt-1 text-sm text-slate-600">
            Pour ajouter un lien, collez simplement l’adresse web (https://…).
          </p>
        </div>
      </div>

      <SiteImageField
        label="Photo"
        helpText="Affichée sur la carte de l’accueil et en haut de l’actualité."
        value={value.imageUrl}
        onChange={(imageUrl) => onChange({ imageUrl })}
        disabled={busy}
        emptyValue=""
      />

      <Collapsible
        title="Plus d’options"
        description="Type (actualité ou sondage), catégorie, heures, lieu, bouton, galerie photos…"
        open={moreOpen}
        onOpenChange={onMoreOpenChange}
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="field-label">Que souhaitez-vous publier ?</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { mode: "news", title: "Actualité", text: "Une information, un événement, un article." },
                  { mode: "poll", title: "Sondage", text: "Une question posée aux visiteurs du site." },
                ] as const
              ).map((choice) => {
                const selected = (choice.mode === "poll") === isPoll;
                return (
                  <label
                    key={choice.mode}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-blue ${
                      selected
                        ? choice.mode === "poll"
                          ? "border-violet-500 bg-violet-50"
                          : "border-brand-blue bg-brand-blue/5"
                        : "border-brand-line bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="news-kind-mode"
                      checked={selected}
                      onChange={() => onKindModeChange(choice.mode)}
                      disabled={busy}
                      className="mt-1 h-5 w-5 shrink-0 accent-brand-blue"
                    />
                    <span>
                      <span className="block text-base font-bold text-slate-900">{choice.title}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">{choice.text}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {savedPoll && !isPoll ? (
              <p
                role="status"
                className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200"
              >
                Attention : cette publication contient un sondage ({voteLabel(savedTotal)}). Avec le choix
                « Actualité », le sondage et ses votes seront supprimés à la publication.
              </p>
            ) : null}
          </fieldset>

          {isPoll ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <h3 className="text-base font-bold text-violet-900">Votre sondage</h3>
              <label className="field-label mt-3">
                Question
                <input
                  value={poll.question}
                  onChange={(event) => onPollChange({ question: event.target.value })}
                  disabled={busy}
                  className="field"
                  placeholder="Ex. Cette activité vous intéresse-t-elle ?"
                />
              </label>
              <p className="mt-4 text-sm font-semibold text-slate-700">
                Réponses possibles ({POLL_MIN_OPTIONS} à {POLL_MAX_OPTIONS})
              </p>
              <ul className="mt-2 space-y-2">
                {poll.options.map((option, index) => {
                  const votes = savedVotes(option.id);
                  return (
                    <li key={option.id} className="flex flex-wrap items-center gap-2">
                      <label className="min-w-[200px] flex-1">
                        <span className="sr-only">Réponse {index + 1}</span>
                        <input
                          value={option.label}
                          onChange={(event) => updateOption(index, event.target.value)}
                          disabled={busy}
                          className="field mt-0"
                          placeholder={`Réponse ${index + 1}`}
                        />
                      </label>
                      {savedPoll && votes > 0 ? (
                        <span className="text-sm font-semibold text-violet-800">{voteLabel(votes)}</span>
                      ) : null}
                      {poll.options.length > POLL_MIN_OPTIONS ? (
                        <button
                          type="button"
                          onClick={() => requestRemoveOption(index)}
                          disabled={busy}
                          className="btn btn-ghost btn-sm"
                          aria-label={`Retirer la réponse ${index + 1}${option.label.trim() ? ` : ${option.label.trim()}` : ""}`}
                        >
                          Retirer
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {poll.options.length < POLL_MAX_OPTIONS ? (
                <button
                  type="button"
                  onClick={() => onPollChange({ options: [...poll.options, { id: randomId("opt"), label: "" }] })}
                  disabled={busy}
                  className="btn btn-outline btn-sm mt-3"
                >
                  Ajouter une réponse
                </button>
              ) : null}
            </div>
          ) : (
            <label className="field-label">
              Catégorie
              <select
                value={CATEGORY_OPTIONS.some((option) => option.value === value.kind) ? value.kind : "autre"}
                onChange={(event) => onChange({ kind: event.target.value })}
                disabled={busy}
                className="field"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field-label">
            Discipline concernée (facultatif)
            <select
              value={value.disciplineId ?? ASSOCIATION_GENERAL_NEWS}
              onChange={(event) =>
                onChange({ disciplineId: event.target.value === ASSOCIATION_GENERAL_NEWS ? null : event.target.value })
              }
              disabled={busy}
              className="field"
            >
              <option value={ASSOCIATION_GENERAL_NEWS}>Toute l’association</option>
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                  {!discipline.active ? " (masquée)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Heure de début
              <input
                type="time"
                value={value.startTime}
                onChange={(event) => onChange({ startTime: event.target.value })}
                disabled={busy}
                className="field"
              />
            </label>
            <label className="field-label">
              Heure de fin
              <input
                type="time"
                value={value.endTime}
                onChange={(event) => onChange({ endTime: event.target.value })}
                disabled={busy}
                className="field"
              />
            </label>
          </div>

          <label className="field-label">
            Lieu
            <input
              value={value.location}
              onChange={(event) => onChange({ location: event.target.value })}
              disabled={busy}
              className="field"
              placeholder="Ex. Gymnase municipal, mairie…"
            />
          </label>

          <label className="field-label">
            Texte du bouton (sur la carte de l’accueil)
            <input
              value={value.ctaLabel ?? ""}
              onChange={(event) => onChange({ ctaLabel: event.target.value })}
              disabled={busy}
              className="field"
              placeholder={isPoll ? "Ex. Donner son avis" : "Ex. Lire la suite"}
            />
          </label>

          <div>
            <p className="field-label">Galerie photos (facultatif)</p>
            <p className="mt-1 text-sm text-slate-600">
              Photos supplémentaires, visibles uniquement sur la page de l’actualité (pas sur l’accueil).
            </p>
            {gallery.length > 0 ? (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((url, index) => (
                  <li key={url} className="overflow-hidden rounded-xl border border-brand-line bg-white">
                    <SiteImage
                      src={url}
                      alt={`Photo ${index + 1} de la galerie`}
                      width={240}
                      height={160}
                      className="h-28 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onChange({ galleryImages: gallery.filter((entry) => entry !== url) })}
                      disabled={disabled}
                      className="btn btn-ghost btn-sm w-full rounded-none border-0 border-t border-brand-line text-rose-700"
                      aria-label={`Retirer la photo ${index + 1} de la galerie`}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Aucune photo dans la galerie pour le moment.</p>
            )}
            <label className="mt-3 block">
              <span className="sr-only">Ajouter des photos à la galerie</span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={disabled}
                onChange={(event) => {
                  void uploadGalleryFiles(event.target.files);
                  event.target.value = "";
                }}
                className="block w-full max-w-md text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-brand-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-50"
              />
            </label>
            {uploading ? <p className="mt-2 text-sm text-brand-blue-dark">Envoi des photos en cours…</p> : null}
            <StatusMessage feedback={galleryFeedback} className="mt-3" />
          </div>
        </div>
      </Collapsible>

      <ConfirmDialog
        open={optionToRemove !== null}
        title="Retirer cette réponse ?"
        message={
          <>
            La réponse « {removedOption?.label || "sans texte"} » a déjà reçu{" "}
            {removedOption ? voteLabel(savedVotes(removedOption.id)).toLowerCase() : "des votes"}. Ces votes seront
            perdus à la publication.
          </>
        }
        confirmLabel="Retirer la réponse"
        cancelLabel="Garder la réponse"
        tone="danger"
        onConfirm={() => {
          if (optionToRemove !== null) removeOption(optionToRemove);
          setOptionToRemove(null);
        }}
        onCancel={() => setOptionToRemove(null)}
      />
    </div>
  );
}
