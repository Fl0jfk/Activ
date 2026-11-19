"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, StatusMessage, type Feedback } from "@/components/bureau-ui";
import { FormField, FormInput, FormSelect } from "@/components/forms/form-field";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import type { DisciplineOption } from "@/lib/discipline-options";

type TrialSlotCreateFormProps = {
  disciplines: DisciplineOption[];
  /** Appelé après une création réussie (ex. pour fermer la fenêtre). */
  onCreated?: (message: string) => void;
  onCancel?: () => void;
};

export default function TrialSlotCreateForm({ disciplines, onCreated, onCancel }: TrialSlotCreateFormProps) {
  const router = useRouter();
  const [disciplineId, setDisciplineId] = useState(disciplines.length === 1 ? disciplines[0]!.id : "");
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("12");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (disciplines.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState>
          Aucune activité n’est active pour le moment. Ajoutez d’abord une activité au planning (onglet
          « Semaine ») avant de créer un créneau d’essai.
        </EmptyState>
        {onCancel ? (
          <div className="flex justify-end">
            <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
              Fermer
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  async function createTrialSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmedTitle = title.trim();
    const capacityNumber = Number(capacity);
    if (!disciplineId) {
      setFeedback({ tone: "error", text: "Choisissez une discipline." });
      return;
    }
    if (!trimmedTitle) {
      setFeedback({ tone: "error", text: "Indiquez un titre pour le créneau." });
      return;
    }
    if (!startsAt) {
      setFeedback({ tone: "error", text: "Indiquez la date et l’heure du créneau." });
      return;
    }
    if (!capacity.trim() || !Number.isInteger(capacityNumber) || capacityNumber < 1 || capacityNumber > 200) {
      setFeedback({
        tone: "error",
        text: "La capacité doit être un nombre entier entre 1 et 200.",
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const result = await fetchJson<{ message?: string }>(
        "/api/club/trial-slots",
        jsonInit("POST", {
          disciplineId,
          title: trimmedTitle,
          startsAt,
          capacity: capacityNumber,
        }),
      );
      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.message || "Le créneau n’a pas pu être créé. Réessayez.",
        });
        return;
      }
      setTitle("");
      setStartsAt("");
      router.refresh();
      const message = result.message || "Créneau créé.";
      if (onCreated) {
        onCreated(message);
      } else {
        setFeedback({ tone: "success", text: message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={createTrialSlot} className="grid gap-4 sm:grid-cols-2" noValidate>
      <FormField label="Discipline">
        <FormSelect value={disciplineId} onChange={(event) => setDisciplineId(event.target.value)} required>
          <option value="">Choisir une discipline…</option>
          {disciplines.map((discipline) => (
            <option key={discipline.id} value={discipline.id}>
              {discipline.name}
            </option>
          ))}
        </FormSelect>
      </FormField>
      <FormField label="Titre" hint="Ex. Séance découverte">
        <FormInput
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
        />
      </FormField>
      <FormField label="Date et heure" hint="Heure de Paris.">
        <FormInput
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          required
        />
      </FormField>
      <FormField label="Nombre de places" hint="Entre 1 et 200.">
        <FormInput
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          step={1}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          required
        />
      </FormField>

      <div className="flex flex-col gap-3 sm:col-span-2">
        <StatusMessage feedback={feedback} />
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost btn-sm">
              Annuler
            </button>
          ) : null}
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Création en cours…" : "Créer le créneau d’essai"}
          </button>
        </div>
      </div>
    </form>
  );
}
