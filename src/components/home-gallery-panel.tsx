"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { AssociationData, HomeGallery, HomeGallerySlide } from "@/lib/site-data-types";
import { randomId } from "@/lib/ids";
import SiteImageField from "@/components/site-image-field";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900";

function emptySlide(): HomeGallerySlide {
  return {
    id: randomId("slide"),
    imageUrl: "",
    caption: "",
  };
}

export default function HomeGalleryPanel() {
  const [data, setData] = useState<AssociationData | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<HomeGallerySlide | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  const gallery: HomeGallery = data?.homeGallery ?? { title: "La vie de l'association", slides: [] };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage("");
    const response = await fetch("/api/admin/site-data");
    if (!response.ok) {
      setStatusMessage("Impossible de charger la galerie.");
      setIsLoading(false);
      return;
    }
    const payload = (await response.json()) as AssociationData;
    setData(payload);
    setTitleDraft(payload.homeGallery?.title ?? "La vie de l'association");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const persistGallery = useCallback(
    async (nextGallery: HomeGallery, successMessage: string): Promise<boolean> => {
      if (!data) return false;
      setIsSaving(true);
      setStatusMessage("");
      const nextData: AssociationData = {
        ...data,
        homeGallery: nextGallery,
      };
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
    [data],
  );

  async function saveTitle() {
    const title = titleDraft.trim() || "La vie de l'association";
    await persistGallery({ ...gallery, title }, "Titre de la galerie enregistré.");
  }

  function startCreate() {
    setDraft(emptySlide());
    setStatusMessage("");
  }

  function startEdit(slide: HomeGallerySlide) {
    setDraft({ ...slide });
    setStatusMessage("");
  }

  function cancelEdit() {
    setDraft(null);
  }

  function updateDraft(patch: Partial<HomeGallerySlide>) {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.imageUrl.trim()) {
      setStatusMessage("Ajoutez une photo avant d'enregistrer.");
      return;
    }

    const exists = gallery.slides.some((slide) => slide.id === draft.id);
    const slides = exists
      ? gallery.slides.map((slide) => (slide.id === draft.id ? draft : slide))
      : [...gallery.slides, draft];

    const ok = await persistGallery(
      { ...gallery, title: titleDraft.trim() || gallery.title, slides },
      exists ? "Slide mise à jour." : "Photo ajoutée à la galerie.",
    );
    if (ok) {
      setDraft(null);
    }
  }

  async function removeSlide(slideId: string) {
    if (!window.confirm("Supprimer cette photo de la galerie ?")) return;
    const slides = gallery.slides.filter((slide) => slide.id !== slideId);
    await persistGallery({ ...gallery, slides }, "Photo supprimée.");
    if (draft?.id === slideId) {
      setDraft(null);
    }
  }

  async function moveSlide(slideId: string, direction: -1 | 1) {
    const index = gallery.slides.findIndex((slide) => slide.id === slideId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= gallery.slides.length) return;
    const slides = [...gallery.slides];
    const [item] = slides.splice(index, 1);
    slides.splice(target, 0, item!);
    await persistGallery({ ...gallery, slides }, "Ordre des slides mis à jour.");
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Galerie d&apos;accueil</h2>
          <p className="mt-1 text-sm text-slate-600">
            Slider de la page d&apos;accueil. Réservé au président : photos, légendes et ordre des
            diapositives.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={isSaving || !!draft}
          className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Ajouter une photo
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1 text-sm font-medium text-slate-700">
          Titre affiché sur le site
          <input
            className={`${inputClass} mt-1`}
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            disabled={isSaving}
            placeholder="La vie de l'association"
          />
        </label>
        <button
          type="button"
          onClick={() => void saveTitle()}
          disabled={isSaving || isLoading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Enregistrer le titre
        </button>
      </div>

      {statusMessage ? (
        <p className="mt-3 text-sm text-slate-700" role="status">
          {statusMessage}
        </p>
      ) : null}
      {isLoading ? <p className="mt-3 text-sm text-slate-500">Chargement…</p> : null}

      {draft ? (
        <div className="mt-4 space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
          <h3 className="text-sm font-bold text-slate-900">
            {gallery.slides.some((slide) => slide.id === draft.id) ? "Modifier la slide" : "Nouvelle slide"}
          </h3>
          <SiteImageField
            label="Photo"
            value={draft.imageUrl}
            emptyValue=""
            disabled={isSaving}
            onChange={(url) => updateDraft({ imageUrl: url })}
            helpText="JPEG, PNG, WebP ou GIF — max 5 Mo."
          />
          <label className="block text-sm font-medium text-slate-700">
            Légende (optionnel)
            <input
              className={`${inputClass} mt-1`}
              value={draft.caption}
              onChange={(event) => updateDraft({ caption: event.target.value })}
              disabled={isSaving}
              placeholder="Ex. Tournoi de tennis de table — juin 2026"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={isSaving}
              className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      <ul className="mt-4 space-y-3">
        {gallery.slides.length === 0 && !isLoading ? (
          <li className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Aucune photo pour le moment. Ajoutez la première slide pour afficher le slider sur
            l&apos;accueil.
          </li>
        ) : null}
        {gallery.slides.map((slide, index) => (
          <li
            key={slide.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"
          >
            <div className="relative h-24 w-full overflow-hidden rounded-lg bg-slate-200 sm:h-20 sm:w-36 sm:shrink-0">
              {slide.imageUrl ? (
                <Image
                  src={slide.imageUrl}
                  alt={slide.caption || `Slide ${index + 1}`}
                  fill
                  unoptimized={slide.imageUrl.startsWith("/api/")}
                  className="object-cover"
                  sizes="144px"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Position {index + 1} / {gallery.slides.length}
              </p>
              <p className="truncate text-sm font-medium text-slate-900">
                {slide.caption || "Sans légende"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void moveSlide(slide.id, -1)}
                disabled={isSaving || index === 0}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                aria-label="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => void moveSlide(slide.id, 1)}
                disabled={isSaving || index === gallery.slides.length - 1}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
                aria-label="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => startEdit(slide)}
                disabled={isSaving || !!draft}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => void removeSlide(slide.id)}
                disabled={isSaving}
                className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
