"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BureauToolNavItem = {
  href: string;
  label: string;
};

const ITEMS: BureauToolNavItem[] = [
  { href: "/espace?tab=cockpit", label: "Cockpit" },
  { href: "/espace/bureau/dossiers", label: "Dossiers" },
  { href: "/espace/bureau/planning", label: "Planning" },
  { href: "/espace/bureau/communication", label: "Communication" },
  { href: "/espace/bureau/adherents", label: "Demandes" },
  { href: "/espace/bureau/contenu", label: "Contenu du site" },
];

export default function BureauToolNav({ canManageSite }: { canManageSite: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter(
    (item) => item.href !== "/espace/bureau/contenu" || canManageSite,
  );

  function isActive(href: string): boolean {
    if (href.startsWith("/espace?")) {
      return pathname === "/espace";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav aria-label="Outils du bureau" className="mx-auto w-full max-w-6xl px-4 sm:px-8">
      <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-3xl border border-brand-line bg-white p-1 shadow-[0_10px_30px_-24px_rgba(20,64,127,0.5)] sm:rounded-full">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
                active
                  ? "bg-brand-blue text-white shadow-sm"
                  : "text-slate-600 hover:bg-brand-cream hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
