"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserButton, useUser } from "@clerk/nextjs";

const HEADER_PX = 64;
type SiteHeaderProps = { facebookUrl: string};

const NAV = [
  { href: "#actualites", label: "Actualités", isAppRoute: false },
  { href: "#programme", label: "Programme", isAppRoute: false },
  { href: "#orientation", label: "Orientation", isAppRoute: false },
  { href: "#disciplines", label: "Disciplines", isAppRoute: false },
  { href: "/association", label: "Organigramme", isAppRoute: true },
] as const;

function MobileMenu({ facebookUrl, onClose,}: { facebookUrl: string; onClose: () => void}) {
  const { isSignedIn } = useUser();
  return (
    <>
      <div className="absolute inset-0 bg-white/94 backdrop-blur-2xl" />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-10 pt-6">
        <nav className="flex flex-col">
          {NAV.map((item, i) => {
            const row =
              "flex items-center py-[18px] text-[21px] font-semibold tracking-tight text-slate-900 transition-colors hover:text-cyan-700 active:text-cyan-700";
            const sep = i < NAV.length - 1 ? " border-b border-slate-200/90" : "";
            return item.isAppRoute ? (
              <Link key={item.href} href={item.href} className={row + sep} onClick={onClose}>
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className={row + sep} onClick={onClose}>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto pt-8">
          {!isSignedIn ? (
            <Link
              href="/sign-in"
              onClick={onClose}
              className="mb-3 block w-full rounded-2xl border border-slate-300 py-3 text-center text-[16px] font-semibold text-slate-800 transition-colors hover:bg-slate-50"
            >
              Se connecter
            </Link>
          ) : null}
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="block w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 py-4 text-center text-[16px] font-semibold text-white shadow-md transition-opacity hover:opacity-90"
          >
            Voir sur Facebook
          </a>
        </div>
      </div>
    </>
  );
}

export default function Header({ facebookUrl }: SiteHeaderProps) {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => { setIsMobile(mq.matches)};
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (!event.matches) setOpen(false);
    };
    apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);
  const close = () => setOpen(false);
  const overlay =
    typeof document !== "undefined" &&
    open &&
    createPortal(
      <div
        className="fixed inset-x-0 bottom-0 z-[90] flex flex-col"
        style={{ top: HEADER_PX }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <MobileMenu facebookUrl={facebookUrl} onClose={close} />
      </div>,
      document.body
    );
  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[100] flex h-16 w-full items-center bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <Link href="/" onClick={close}>
            <Image src="/logo.png" alt="Activ Sainte-Croix" width={100} height={100}/>
          </Link>
          <nav className="shrink-0 items-center gap-8" style={{ display: isMobile ? "none" : "flex" }}>
            {NAV.map((item) =>
              item.isAppRoute ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[13px] font-medium text-slate-800 transition-colors hover:text-cyan-700"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-[13px] font-medium text-slate-800 transition-colors hover:text-cyan-700"
                >
                  {item.label}
                </a>
              ),
            )}
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Facebook
            </a>
            {!isSignedIn ? (
              <Link
                href="/sign-in"
                className="rounded-full border border-slate-300 px-4 py-1.5 text-[13px] font-semibold text-slate-800 transition-colors hover:bg-slate-100"
              >
                Connexion
              </Link>
            ) : null}
            {isSignedIn ? <UserButton afterSignOutUrl="/" /> : null}
          </nav>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            className="relative h-11 w-11 shrink-0 flex-col items-center justify-center gap-[6px]"
            style={{ display: isMobile ? "flex" : "none" }}
          >
            <span
              className={`block h-0.5 w-6 rounded-full bg-slate-900 transition-transform duration-300 ease-out ${
                open ? "translate-y-[8px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-6 rounded-full bg-slate-900 transition-opacity duration-200 ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-6 rounded-full bg-slate-900 transition-transform duration-300 ease-out ${
                open ? "-translate-y-[8px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </header>
      <div className="h-16 shrink-0" aria-hidden />
      {overlay}
    </>
  );
}
