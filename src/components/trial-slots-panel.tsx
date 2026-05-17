"use client";

import TrialSlotCreateForm from "@/components/trial-slot-create-form";
import type { RegistrationApplication } from "@/lib/club-data";
import type { TrialSlotSummary } from "@/lib/club-types";
import type { DisciplineOption } from "@/lib/discipline-options";
import { countTrialSlotRegistrations } from "@/lib/trial-slots";

type TrialSlotsPanelProps = {
  disciplines: DisciplineOption[];
  slots: TrialSlotSummary[];
  applications: RegistrationApplication[];
};

export default function TrialSlotsPanel({ disciplines, slots, applications }: TrialSlotsPanelProps) {
  const upcomingSlots = [...slots]
    .filter((slot) => new Date(slot.startsAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return (
    <div className="space-y-4">
      <TrialSlotCreateForm disciplines={disciplines} />

      {upcomingSlots.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2 pr-4">Discipline</th>
                <th className="py-2 pr-4">Titre</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Inscrits</th>
              </tr>
            </thead>
            <tbody>
              {upcomingSlots.map((slot) => (
                <tr key={slot.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    {disciplines.find((d) => d.id === slot.disciplineId)?.name ?? "—"}
                  </td>
                  <td className="py-2 pr-4">{slot.title}</td>
                  <td className="py-2 pr-4">{new Date(slot.startsAt).toLocaleString("fr-FR")}</td>
                  <td className="py-2 pr-4">
                    {countTrialSlotRegistrations(applications, slot.id)} / {slot.capacity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Aucun créneau d&apos;essai à venir.</p>
      )}
    </div>
  );
}
