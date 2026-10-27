"use client";

import { useState } from "react";
import AdminDashboardPage from "@/app/admin/dashboard/page";

export default function BureauSiteSettingsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bento-card min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
            Configuration
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            Informations du site
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Coordonnées de l’association, tampon des reçus, organigramme, disciplines et horaires.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          {open ? "Replier les paramètres" : "Ouvrir les paramètres"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <AdminDashboardPage embedded />
        </div>
      ) : null}
    </section>
  );
}
