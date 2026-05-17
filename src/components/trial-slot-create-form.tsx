"use client";

import { FormEvent, useState } from "react";
import type { DisciplineOption } from "@/lib/discipline-options";
import { FormField, FormInput, FormSelect } from "@/components/forms/form-field";

type TrialSlotCreateFormProps = {
  disciplines: DisciplineOption[];
  onCreated?: () => void;
};

export default function TrialSlotCreateForm({ disciplines, onCreated }: TrialSlotCreateFormProps) {
  const [slotDisciplineId, setSlotDisciplineId] = useState(disciplines[0]?.id ?? "");
  const [slotTitle, setSlotTitle] = useState("");
  const [slotStartsAt, setSlotStartsAt] = useState("");
  const [slotCapacity, setSlotCapacity] = useState(12);
  const [message, setMessage] = useState("");

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
      onCreated?.() ?? window.location.reload();
    }
  }

  return (
    <form onSubmit={createTrialSlot} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <FormField label="Discipline">
        <FormSelect value={slotDisciplineId} onChange={(e) => setSlotDisciplineId(e.target.value)} required>
          {disciplines.map((discipline) => (
            <option key={discipline.id} value={discipline.id}>
              {discipline.name}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Titre">
        <FormInput value={slotTitle} onChange={(e) => setSlotTitle(e.target.value)} required />
      </FormField>
      <FormField label="Date et heure">
        <FormInput
          type="datetime-local"
          value={slotStartsAt}
          onChange={(e) => setSlotStartsAt(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Capacité">
        <FormInput
          type="number"
          min={1}
          value={slotCapacity}
          onChange={(e) => setSlotCapacity(Number(e.target.value))}
          required
        />
      </FormField>
      <button
        type="submit"
        className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-2"
      >
        Créer le créneau d&apos;essai
      </button>
      {message ? <p className="text-sm text-slate-700 sm:col-span-2">{message}</p> : null}
    </form>
  );
}
