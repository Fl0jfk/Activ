"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useClerk, useUser } from "@clerk/nextjs";
import AccountMenu, { ACCOUNT_SETTINGS_HREF } from "@/components/account-menu";
import CallButton from "@/components/call-button";
import FacebookButton from "@/components/facebook-button";

const HEADER_PX = 68;
type SiteHeaderProps = { facebookUrl: string; showNewsNav?: boolean };

const NAV_ITEMS = [
  { href: "/#planning", label: "Planning" },
  { href: "/#disciplines", label: "Disciplines" },
  { href: "/actualites", label: "Actualités", newsOnly: true },
  { href: "/contact", label: "Contact" },
] as const;

const MOBILE_LIST_ROW =
  "flex min-h-[60px] items-center border-b border-brand-line py-[18px] text-[21px] font-semibold tracking-tight";

function navItems(showNewsNav: boolean) {
  return NAV_ITEMS.filter((item) => !("newsOnly" in item && item.newsOnly) || showNewsNav);
}

function MobileMenu({
  facebookUrl,
  showNewsNav,
  onClose,
}: {
  facebookUrl: string;
  showNewsNav: boolean;
  onClose: () => void;
}) {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  return (
    <>
      <div className="absolute inset-0 bg-brand-cream/98 backdrop-blur-2xl" />
      <div className="relative flex h-full flex-col overflow-y-auto px-6 pb-8 pt-4">
        <nav className="flex flex-1 flex-col" aria-label="Menu principal">
          {navItems(showNewsNav).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${MOBILE_LIST_ROW} text-slate-900 transition-colors hover:text-brand-blue active:text-brand-blue`}
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
          {isSignedIn ? (
            <>
              <Link
                href="/espace"
                onClick={onClose}
                className={`${MOBILE_LIST_ROW} text-slate-900 transition-colors hover:text-brand-blue active:text-brand-blue`}
              >
                Mon espace
              </Link>
              <Link
                href={ACCOUNT_SETTINGS_HREF}
                onClick={onClose}
                className={`${MOBILE_LIST_ROW} text-slate-900 transition-colors hover:text-brand-blue active:text-brand-blue`}
              >
                Mon compte et mot de passe
              </Link>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  void signOut({ redirectUrl: "/" });
                }}
                className={`${MOBILE_LIST_ROW} w-full text-left text-rose-700`}
              >
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                onClick={onClose}
                className={`${MOBILE_LIST_ROW} text-slate-900 transition-colors hover:text-brand-blue active:text-brand-blue`}
              >
                Connexion
              </Link>
              <Link href="/preinscription" onClick={onClose} className="btn btn-primary mt-6 w-full text-lg">
                Pré-inscription
              </Link>
            </>
          )}
          <div className="mt-6 flex items-center gap-4">
            <CallButton />
            <FacebookButton href={facebookUrl} onClick={onClose} />
          </div>
        </nav>
      </div>
    </>
  );
}

export default function Header({ facebookUrl, showNewsNav = false }: SiteHeaderProps) {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
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
        className="fixed inset-x-0 bottom-0 z-[90] flex flex-col md:hidden"
        style={{ top: HEADER_PX }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <MobileMenu facebookUrl={facebookUrl} showNewsNav={showNewsNav} onClose={close} />
      </div>,
      document.body
    );
  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-[100] flex h-[68px] w-full items-center border-b border-brand-line bg-brand-cream/92 backdrop-blur-xl">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          {/* Le PNG a des marges transparentes : on l'agrandit en le laissant déborder sans changer la hauteur du header. */}
          <Link href="/" onClick={close} className="relative block h-[68px] w-[78px] shrink-0" aria-label="Activ' Sainte-Croix, accueil">
            <Image
              src="/logo.png"
              alt="Activ' Sainte-Croix Sport et Culture"
              width={561}
              height={445}
              className="pointer-events-none absolute -left-4 -top-[9px] h-[88px] w-auto max-w-none"
              priority
            />
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] font-semibold text-slate-800 md:flex" aria-label="Menu principal">
            {navItems(showNewsNav).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b-2 border-transparent py-1 transition-colors hover:border-brand-blue hover:text-brand-blue"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <AccountMenu />
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="hidden text-sm font-semibold text-slate-600 transition-colors hover:text-brand-blue md:inline"
                >
                  Connexion
                </Link>
                <Link href="/preinscription" className="btn btn-primary btn-sm whitespace-nowrap">
                  Pré-inscription
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              className="relative flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[6px] md:hidden"
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
        </div>
      </header>
      <div className="h-[68px] shrink-0" aria-hidden />
      {overlay}
    </>
  );
}
