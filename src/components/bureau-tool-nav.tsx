"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BureauToolNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
};

const ITEMS: BureauToolNavItem[] = [
  { href: "/espace", label: "Cockpit" },
  { href: "/espace/bureau/dossiers", label: "Dossiers", shortLabel: "Dossiers" },
  { href: "/espace/bureau/planning", label: "Essais & planning", shortLabel: "Planning" },
  { href: "/espace/bureau/communication", label: "E-mail", shortLabel: "E-mail" },
  { href: "/espace/bureau/adherents", label: "Adhérents", shortLabel: "Adhérents" },
  { href: "/espace/bureau/contenu", label: "Contenu du site", shortLabel: "Contenu" },
];

export default function BureauToolNav({ canManageSite }: { canManageSite: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter(
    (item) => item.href !== "/espace/bureau/contenu" || canManageSite,
  );

  function isActive(href: string): boolean {
    if (href === "/espace") {
      return pathname === "/espace";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      aria-label="Outils du bureau"
      className="mx-auto w-full max-w-6xl px-4 sm:px-8"
    >
      <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.4)] backdrop-blur-xl">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                active
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
