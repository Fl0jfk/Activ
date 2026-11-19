"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";

function initialsOf(firstName?: string | null, lastName?: string | null, email?: string): string {
  const letters = `${firstName?.trim().charAt(0) ?? ""}${lastName?.trim().charAt(0) ?? ""}`;
  return (letters || email?.trim().charAt(0) || "?").toUpperCase();
}

export const ACCOUNT_SETTINGS_HREF = "/espace?tab=member#mon-compte";

export default function AccountMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mon compte"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-sm font-extrabold text-white shadow-sm ring-2 ring-white transition hover:bg-brand-blue-dark focus-visible:outline-none focus-visible:ring-brand-blue/40"
      >
        {initialsOf(user?.firstName, user?.lastName, email)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-brand-line bg-white p-2 shadow-[0_24px_50px_-20px_rgba(20,64,127,0.45)]"
        >
          <div className="border-b border-brand-line px-3 pb-3 pt-2">
            {fullName ? <p className="truncate text-sm font-extrabold text-slate-900">{fullName}</p> : null}
            {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
          </div>
          <Link
            href="/espace"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-brand-cream"
          >
            Mon espace
          </Link>
          <Link
            href={ACCOUNT_SETTINGS_HREF}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-brand-cream"
          >
            Mon compte et mot de passe
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut({ redirectUrl: "/" })}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            Se déconnecter
          </button>
        </div>
      ) : null}
    </div>
  );
}
