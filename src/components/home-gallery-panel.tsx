"use client";

import { useRef, useState } from "react";
import { Badge, ConfirmDialog, EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import { NewTabLink } from "@/components/site-content-ui";
import SiteImage from "@/components/site-image";
import SiteImageField from "@/components/site-image-field";
import { randomId } from "@/lib/ids";
import { HOME_PHOTO_COUNT } from "@/lib/public-site-constants";
import type { AssociationData, HomeGallery, HomeGallerySlide } from "@/lib/site-data-types";
import { saveFromFreshData, type SiteSections } from "@/lib/use-site-data";

// Même valeur que le titre par défaut enregistré côté serveur.
const DEFAULT_TITLE = "La vie de l'association";

type Props = {
  data: AssociationData;
  onSaved: (saved: SiteSections) => void;
};

type PhotoRole = { label: string; tone: "green" | "blue" | "slate" };

function photoRoles(index: number, total: number): PhotoRole[] {
  const roles: PhotoRole[] = [];
  if (index === 0) roles.push({ label: "Photo d’en-tête de l’accueil", tone: "green" });
  if (index >= total - HOME_PHOTO_COUNT) roles.push({ label: "Mosaïque de l’accueil", tone: "blue" });
  if (roles.length === 0) roles.push({ label: "Page Photos seulement", tone: "slate" });
  return roles;
}

function photoName(slide: HomeGallerySlide, index: number): string {
  return slide.caption.trim() ? `« ${slide.caption.trim()} »` : `numéro ${index + 1}`;
}

export default function HomeGalleryPanel({ data, onSaved }: Props) {
  const savingRef = useRef(false);
  const gallery: HomeGallery = data.homeGallery;
  const slides = gallery.slides;

  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<HomeGallerySlide | null>(null);
  const [isNewSlide, setIsNewSlide] = useState(false);
  const [titleDraft, setTitleDraft] = useState(gallery.title);
  const [titleFeedback, setTitleFeedback] = useState<Feedback>(null);
  const [formFeedback, setFormFeedback] = useState<Feedback>(null);
  const [listFeedback, setListFeedback] = useState<Feedback>(null);
  const [slideToDelete, setSlideToDelete] = useState<HomeGallerySlide | null>(null);

  const titleChanged = titleDraft.trim() !== gallery.title.trim();

  /** Une seule sauvegarde à la fois : les boutons sont désactivés pendant l’enregistrement. */
  async function persist(
    update: (fresh: HomeGallery) => HomeGallery | string,
    onFeedback: (feedback: Feedback) => void,
    successText: string,
  ): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    onFeedback(null);
    try {
      const result = await saveFromFreshData((fresh) => {
        const next = update(fresh.homeGallery);
        return typeof next === "string" ? next : { homeGallery: next };
      });
      if (!result.ok) {
        onFeedback({ tone: "error", text: result.message });
        return false;
      }
      onSaved(result.saved);
      onFeedback({ tone: "success", text: successText });
      return true;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function saveTitle() {
    const title = titleDraft.trim() || DEFAULT_TITLE;
    const ok = await persist((fresh) => ({ ...fresh, title }), setTitleFeedback, "Titre enregistré.");
    if (ok) setTitleDraft(title);
  }

  function startCreate() {
    setDraft({ id: randomId("slide"), imageUrl: "", caption: "" });
    setIsNewSlide(true);
    setFormFeedback(null);
    setListFeedback(null);
  }

  function startEdit(slide: HomeGallerySlide) {
    setDraft({ ...slide });
    setIsNewSlide(false);
    setFormFeedback(null);
    setListFeedback(null);
  }

  function cancelEdit() {
    setDraft(null);
    setFormFeedback(null);
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.imageUrl.trim()) {
      setFormFeedback({ tone: "error", text: "Ajoutez une photo avant d’enregistrer." });
      return;
    }
    const slide: HomeGallerySlide = { ...draft, caption: draft.caption.trim() };
    const ok = await persist(
      (fresh) => ({
        ...fresh,
        slides: fresh.slides.some((entry) => entry.id === slide.id)
          ? fresh.slides.map((entry) => (entry.id === slide.id ? slide : entry))
          : [...fresh.slides, slide],
      }),
      setFormFeedback,
      "",
    );
    if (ok) {
      setDraft(null);
      setFormFeedback(null);
      setListFeedback({
        tone: "success",
        text: isNewSlide
          ? "Photo ajoutée à la fin de la liste : elle apparaît dans la mosaïque de l’accueil."
          : "Photo mise à jour.",
      });
    }
  }

  async function deleteSlide() {
    const slide = slideToDelete;
    if (!slide) return;
    const ok = await persist(
      (fresh) => ({ ...fresh, slides: fresh.slides.filter((entry) => entry.id !== slide.id) }),
      setListFeedback,
      "Photo supprimée.",
    );
    if (ok && draft?.id === slide.id) setDraft(null);
    setSlideToDelete(null);
  }

  async function moveSlide(slide: HomeGallerySlide, direction: -1 | 1) {
    await persist(
      (fresh) => {
        const index = fresh.slides.findIndex((entry) => entry.id === slide.id);
        const target = index + direction;
        if (index < 0) return "Cette photo a été supprimée entre-temps. Rechargez la page.";
        if (target < 0 || target >= fresh.slides.length) return fresh;
        const next = [...fresh.slides];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved!);
        return { ...fresh, slides: next };
      },
      setListFeedback,
      "Ordre des photos mis à jour.",
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Photos de l’accueil"
        description="L’ordre de la liste décide de l’endroit où chaque photo s’affiche sur le site."
        action={
          <>
            <NewTabLink href="/">Voir l’accueil</NewTabLink>
            <button type="button" onClick={startCreate} disabled={saving || draft !== null} className="btn btn-primary">
              Ajouter une photo
            </button>
          </>
        }
      >
        <ul className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
          <li className="rounded-2xl bg-brand-green/10 p-3">
            <span className="block font-bold text-brand-green-dark">Photo d’en-tête de l’accueil</span>
            La toute première photo de la liste, en haut de la page d’accueil.
          </li>
          <li className="rounded-2xl bg-brand-blue/10 p-3">
            <span className="block font-bold text-brand-blue-dark">Mosaïque de l’accueil</span>
            Les {HOME_PHOTO_COUNT} dernières photos de la liste (les plus récentes).
          </li>
          <li className="rounded-2xl bg-slate-100 p-3">
            <span className="block font-bold text-slate-800">Page Photos seulement</span>
            Les autres photos, visibles uniquement sur la page Photos.
          </li>
        </ul>

        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void saveTitle();
          }}
        >
          <label className="field-label min-w-[240px] flex-1">
            Titre affiché au-dessus des photos
            <input
              className="field"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              disabled={saving}
              placeholder={DEFAULT_TITLE}
              maxLength={120}
            />
          </label>
          <button type="submit" disabled={saving || !titleChanged} className="btn btn-outline btn-sm mb-0.5">
            Enregistrer le titre
          </button>
        </form>
        <StatusMessage feedback={titleFeedback} className="mt-3" />
      </SectionCard>

      {draft ? (
        <section className="panel space-y-4 border-brand-blue/40 p-5 sm:p-6" aria-label="Formulaire de photo">
          <h3 className="text-lg font-extrabold text-slate-900">
            {isNewSlide ? "Ajouter une photo" : "Modifier la photo"}
          </h3>
          <SiteImageField
            label="Photo"
            value={draft.imageUrl}
            emptyValue=""
            disabled={saving}
            onChange={(url) => setDraft((previous) => (previous ? { ...previous, imageUrl: url } : previous))}
            helpText="JPEG, PNG, WebP ou GIF — 5 Mo maximum."
          />
          <label className="field-label">
            Légende (facultatif)
            <input
              className="field"
              value={draft.caption}
              onChange={(event) =>
                setDraft((previous) => (previous ? { ...previous, caption: event.target.value } : previous))
              }
              disabled={saving}
              placeholder="Ex. Tournoi de tennis de table — juin 2026"
              maxLength={200}
            />
          </label>
          {isNewSlide ? (
            <p className="text-sm text-slate-600">
              La photo sera ajoutée à la fin de la liste : elle apparaîtra dans la mosaïque de l’accueil. Vous pourrez
              ensuite la déplacer.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="btn btn-primary">
              {saving ? "Enregistrement…" : "Enregistrer la photo"}
            </button>
            <button type="button" onClick={cancelEdit} disabled={saving} className="btn btn-ghost">
              Annuler
            </button>
          </div>
          <StatusMessage feedback={formFeedback} />
        </section>
      ) : null}

      <SectionCard title={`Les photos (${slides.length})`}>
        <StatusMessage feedback={listFeedback} className="mb-4" />
        {slides.length === 0 ? (
          <EmptyState>
            Aucune photo pour le moment. Cliquez sur « Ajouter une photo » pour illustrer l’accueil du site.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {slides.map((slide, index) => {
              const name = photoName(slide, index);
              return (
                <li key={slide.id} className="flex flex-col gap-3 rounded-2xl border border-brand-line bg-white p-3 sm:flex-row">
                  <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-40">
                    <SiteImage
                      src={slide.imageUrl}
                      alt={slide.caption.trim() || `Photo numéro ${index + 1}`}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {photoRoles(index, slides.length).map((role) => (
                        <Badge key={role.label} tone={role.tone}>
                          {role.label}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-break mt-2 text-sm font-semibold text-slate-900">
                      {slide.caption.trim() || "Sans légende"}
                    </p>
                    <p className="text-sm text-slate-600">
                      Photo {index + 1} sur {slides.length}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void moveSlide(slide, -1)}
                        disabled={saving || index === 0}
                        className="btn btn-ghost btn-sm"
                        aria-label={`Monter la photo ${name}`}
                      >
                        <span aria-hidden="true">↑</span> Monter
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveSlide(slide, 1)}
                        disabled={saving || index === slides.length - 1}
                        className="btn btn-ghost btn-sm"
                        aria-label={`Descendre la photo ${name}`}
                      >
                        <span aria-hidden="true">↓</span> Descendre
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(slide)}
                        disabled={saving || draft !== null}
                        className="btn btn-outline btn-sm"
                        aria-label={`Modifier la photo ${name}`}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideToDelete(slide)}
                        disabled={saving}
                        className="btn btn-ghost btn-sm border-rose-200 text-rose-700 hover:bg-rose-50"
                        aria-label={`Supprimer la photo ${name}`}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <ConfirmDialog
        open={slideToDelete !== null}
        title="Supprimer cette photo ?"
        message={
          slideToDelete
            ? `La photo ${photoName(slideToDelete, slides.findIndex((entry) => entry.id === slideToDelete.id))} sera retirée du site. Cette action est définitive.`
            : undefined
        }
        confirmLabel="Supprimer la photo"
        cancelLabel="Garder la photo"
        tone="danger"
        busy={saving}
        onConfirm={() => void deleteSlide()}
        onCancel={() => setSlideToDelete(null)}
      />
    </div>
  );
}
