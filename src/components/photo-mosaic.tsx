"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SiteImage from "@/components/site-image";
import type { HomeGallerySlide } from "@/lib/site-data-types";

type PhotoMosaicProps = {
  slides: HomeGallerySlide[];
  fallbackAlt: string;
};

export default function PhotoMosaic({ slides, fallbackAlt }: PhotoMosaicProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setOpenIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (openIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") goTo(openIndex - 1);
      if (event.key === "ArrowRight") goTo(openIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex, close, goTo]);

  if (slides.length === 0) return null;

  const current = openIndex !== null ? slides[openIndex] : null;

  const lightbox =
    typeof document !== "undefined" &&
    current &&
    openIndex !== null &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/92 p-3 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label={current.caption || fallbackAlt}
        onClick={close}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl font-bold text-slate-800 shadow"
          aria-label="Fermer"
        >
          ×
        </button>
        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goTo(openIndex - 1);
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
                goTo(openIndex + 1);
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
          <SiteImage
            src={current.imageUrl}
            alt={current.caption || fallbackAlt}
            width={1600}
            height={1200}
            className="max-h-[min(86vh,900px)] w-auto max-w-[min(96vw,1200px)] rounded-xl object-contain shadow-2xl"
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
    <>
      <ul className="columns-2 gap-3.5 sm:columns-3 lg:columns-4">
        {slides.map((slide, index) => (
          <li key={slide.id} className="mb-3.5 break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`Agrandir la photo : ${slide.caption || fallbackAlt}`}
              className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-slate-200"
            >
              <SiteImage
                src={slide.imageUrl}
                alt={slide.caption || fallbackAlt}
                width={0}
                height={0}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                style={{ width: "100%", height: "auto" }}
                className="min-h-24 transition duration-500 group-hover:scale-[1.03]"
              />
              {slide.caption ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2.5 pt-8 text-left text-[12.5px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {slide.caption}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {lightbox}
    </>
  );
}
