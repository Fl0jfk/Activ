"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { HomeGallery } from "@/lib/site-data-types";

const AUTO_MS = 4500;

type HomeGallerySliderProps = {
  gallery: HomeGallery;
};

export default function HomeGallerySlider({ gallery }: HomeGallerySliderProps) {
  const slides = gallery.slides;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setIndex(((next % slides.length) + slides.length) % slides.length);
      setProgressKey((key) => key + 1);
    },
    [slides.length],
  );

  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (slides.length <= 1 || paused || lightboxOpen) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
      setProgressKey((key) => key + 1);
    }, AUTO_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused, index, lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightboxOpen, goPrev, goNext]);

  if (slides.length === 0) {
    return null;
  }

  const current = slides[index]!;
  const autoplay = slides.length > 1;

  const lightbox =
    typeof document !== "undefined" &&
    lightboxOpen &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/92 p-3 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label={current.caption || gallery.title || "Photo en grand"}
        onClick={() => setLightboxOpen(false)}
      >
        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow"
          aria-label="Fermer"
        >
          ×
        </button>
        {autoplay ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow sm:left-6"
              aria-label="Photo précédente"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow sm:right-6"
              aria-label="Photo suivante"
            >
              ›
            </button>
          </>
        ) : null}
        <figure
          className="relative flex max-h-full max-w-full flex-col items-center"
          onClick={(event) => event.stopPropagation()}
        >
          <Image
            src={current.imageUrl}
            alt={current.caption || gallery.title}
            width={1600}
            height={1200}
            unoptimized={current.imageUrl.startsWith("/api/")}
            className="max-h-[min(88vh,900px)] w-auto max-w-[min(96vw,1200px)] rounded-xl object-contain shadow-2xl"
          />
          {current.caption ? (
            <figcaption className="mt-3 max-w-3xl text-center text-sm font-medium text-white sm:text-base">
              {current.caption}
            </figcaption>
          ) : null}
        </figure>
      </div>,
      document.body,
    );

  return (
    <section id="galerie" className="anchor-section panel mt-8 overflow-hidden p-0">
      <div
        className="relative aspect-[16/9] w-full bg-slate-900 sm:aspect-[21/9]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                active ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-hidden={!active}
            >
              <Image
                src={slide.imageUrl}
                alt={slide.caption || gallery.title}
                fill
                priority={slideIndex === 0}
                unoptimized={slide.imageUrl.startsWith("/api/")}
                className={`object-cover transition-transform duration-[4500ms] ease-out ${
                  active ? "scale-105" : "scale-100"
                }`}
                sizes="(max-width: 1152px) 100vw, 1152px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 z-10 cursor-zoom-in"
          aria-label="Afficher la photo en grand"
        />

        {current.caption ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-14 sm:px-8 sm:pb-16">
            <p className="max-w-2xl text-base font-medium text-white drop-shadow sm:text-xl">
              {current.caption}
            </p>
          </div>
        ) : null}

        {autoplay ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-slate-800 shadow transition hover:bg-white sm:left-5"
              aria-label="Photo précédente"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-slate-800 shadow transition hover:bg-white sm:right-5"
              aria-label="Photo suivante"
            >
              ›
            </button>

            <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-2">
              {slides.map((slide, slideIndex) => {
                const active = slideIndex === index;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(slideIndex)}
                    className={`relative h-2.5 overflow-hidden rounded-full transition-all ${
                      active ? "w-8 bg-white/35" : "w-2.5 bg-white/50 hover:bg-white/80"
                    }`}
                    aria-label={`Aller à la photo ${slideIndex + 1}`}
                    aria-current={active}
                  >
                    {active && !paused && !lightboxOpen ? (
                      <span
                        key={progressKey}
                        className="absolute inset-y-0 left-0 rounded-full bg-white"
                        style={{ animation: `home-gallery-progress ${AUTO_MS}ms linear forwards` }}
                      />
                    ) : active ? (
                      <span className="absolute inset-0 rounded-full bg-white" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
      {lightbox}
    </section>
  );
}
