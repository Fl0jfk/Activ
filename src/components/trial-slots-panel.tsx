"use client";

import { FormEvent, useState } from "react";

type Discipline = { id: string; name: string };
type TrialSlot = { id: string; disciplineId: string; title: string; startsAt: string; capacity: number };
type Application = { trialSlotId: string | null };

type TrialSlotsPanelProps = {
  disciplines: Discipline[];
  slots: TrialSlot[];
  applications: Application[];
};

export default function TrialSlotsPanel({ disciplines, slots, applications }: TrialSlotsPanelProps) {
  const [slotDisciplineId, setSlotDisciplineId] = useState(disciplines[0]?.id ?? "");
  const [slotTitle, setSlotTitle] = useState("");
  const [slotStartsAt, setSlotStartsAt] = useState("");
  const [slotCapacity, setSlotCapacity] = useState(12);
  const [message, setMessage] = useState("");

  const upcomingSlots = [...slots]
    .filter((slot) => new Date(slot.startsAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  function countForSlot(slotId: string) {
    return applications.filter((a) => a.trialSlotId === slotId).length;
  }

  async function createTrialSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/club/trial-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disciplineId: slotDisciplineId,
        title: slotTitle,
        startsAt: slotStartsAt,
        capacity: slotCapacity,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Créneau créé." : "Erreur."));
    if (response.ok) {
      setSlotTitle("");
      setSlotStartsAt("");
      window.location.reload();
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createTrialSlot} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Discipline
          <select
            value={slotDisciplineId}
            onChange={(event) => setSlotDisciplineId(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          >
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Intitulé
          <input
            value={slotTitle}
            onChange={(event) => setSlotTitle(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            placeholder="Essai débutants"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Date et heure
          <input
            type="datetime-local"
            value={slotStartsAt}
            onChange={(event) => setSlotStartsAt(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Capacité
          <input
            type="number"
            min={1}
            value={slotCapacity}
            onChange={(event) => setSlotCapacity(Number(event.target.value))}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-cyan-700 px-5 py-3 font-semibold text-white sm:col-span-2"
        >
          Ajouter un créneau d&apos;essai
        </button>
      </form>

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
                  <td className="py-2 pr-4">
                    {new Date(slot.startsAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2 pr-4">
                    {countForSlot(slot.id)} / {slot.capacity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Aucun créneau d&apos;essai à venir.</p>
      )}

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
