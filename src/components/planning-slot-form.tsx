"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, StatusMessage, type Feedback } from "@/components/bureau-ui";
import { FormField, FormInput, FormSelect } from "@/components/forms/form-field";
import { fetchJson, jsonInit } from "@/lib/fetch-json";
import type { PlanningDiscipline } from "@/lib/planning-types";
import { DAY_LABELS, type DayOfWeek } from "@/lib/schedule-constants";
import { normalizeScheduleTime, parseScheduleTimeToMinutes } from "@/lib/schedule-week";

const NEW_ACTIVITY = "__new__";
const DAY_OPTIONS = Object.entries(DAY_LABELS) as [string, string][];

type PlanningSlotFormProps = {
  disciplines: PlanningDiscipline[];
  teacherSuggestions: string[];
  defaults?: { dayOfWeek?: DayOfWeek; startTime?: string };
  onDone: (message: string) => void;
  onCancel: () => void;
};

function addOneHour(time: string | undefined): string {
  const minutes = time ? parseScheduleTimeToMinutes(time) : null;
  if (minutes === null) return "";
  const end = Math.min(23 * 60 + 59, minutes + 60);
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export default function PlanningSlotForm({
  disciplines,
  teacherSuggestions,
  defaults,
  onDone,
  onCancel,
}: PlanningSlotFormProps) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [newName, setNewName] = useState("");
  const [annualFee, setAnnualFee] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(String(defaults?.dayOfWeek ?? 1));
  const [startTime, setStartTime] = useState(defaults?.startTime ?? "");
  const [endTime, setEndTime] = useState(addOneHour(defaults?.startTime));
  const [location, setLocation] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState(false);

  const isNew = choice === NEW_ACTIVITY;
  const chosen = disciplines.find((discipline) => discipline.id === choice);
  const isInactive = chosen ? !chosen.active : false;
  const byName = (a: PlanningDiscipline, b: PlanningDiscipline) => a.name.localeCompare(b.name, "fr");
  const activeDisciplines = disciplines.filter((discipline) => discipline.active).sort(byName);
  const inactiveDisciplines = disciplines.filter((discipline) => !discipline.active).sort(byName);

  function validate(): string | null {
    if (!choice) return "Choisissez une activité dans la liste.";
    if (isNew) {
      const name = newName.trim();
      if (!name) return "Indiquez le nom de la nouvelle activité.";
      const same = disciplines.find(
        (discipline) => discipline.name.trim().toLowerCase() === name.toLowerCase(),
      );
      if (same) {
        return `L'activité « ${same.name} » existe déjà : choisissez-la dans la liste au lieu d'en créer une nouvelle.`;
      }
    }
    const start = normalizeScheduleTime(startTime);
    const end = normalizeScheduleTime(endTime);
    if (!start || !end) return "Indiquez l'heure de début et l'heure de fin.";
    if ((parseScheduleTimeToMinutes(start) ?? 0) >= (parseScheduleTimeToMinutes(end) ?? 0)) {
      return "L'heure de fin doit être après l'heure de début.";
    }
    return null;
  }

  async function submit() {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await fetchJson<{ message?: string }>(
        "/api/admin/schedule-slots",
        jsonInit("POST", {
          ...(isNew
            ? { createDiscipline: true, disciplineName: newName.trim(), annualFee: annualFee.trim() }
            : { disciplineId: choice, reactivate: isInactive }),
          dayOfWeek: Number(dayOfWeek),
          startTime,
          endTime,
          location: location.trim(),
          teacherName: teacherName.trim(),
        }),
      );
      if (!result.ok) {
        setConfirming(false);
        setFeedback({
          tone: "error",
          text: result.message || "Le créneau n'a pas pu être ajouté. Réessayez.",
        });
        return;
      }
      router.refresh();
      onDone(result.message || "Créneau ajouté au planning.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setFeedback({ tone: "error", text: problem });
      return;
    }
    setFeedback(null);
    if (isNew || isInactive) {
      setConfirming(true);
      return;
    }
    void submit();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <p className="text-sm leading-6 text-slate-700 sm:col-span-2">
          Ce créneau revient <strong>chaque semaine</strong> au même jour et à la même heure. Il apparaît
          aussitôt sur le site et dans le bulletin d’adhésion.
        </p>

        <FormField label="Activité" className="sm:col-span-2">
          <FormSelect value={choice} onChange={(event) => setChoice(event.target.value)} required>
            <option value="">Choisir une activité…</option>
            {activeDisciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
            {inactiveDisciplines.length > 0 ? (
              <optgroup label="Activités désactivées">
                {inactiveDisciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name} (désactivée)
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value={NEW_ACTIVITY}>＋ Nouvelle activité…</option>
          </FormSelect>
        </FormField>

        {isInactive ? (
          <StatusMessage
            className="sm:col-span-2"
            feedback={{
              tone: "info",
              text: "Cette activité est désactivée : ajouter un créneau la réactivera sur le site.",
            }}
          />
        ) : null}

        {isNew ? (
          <>
            <FormField label="Nom de la nouvelle activité">
              <FormInput
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ex. Théâtre, Randonnée, Danse…"
                maxLength={80}
                required
              />
            </FormField>
            <FormField label="Tarif annuel (facultatif)">
              <FormInput
                value={annualFee}
                onChange={(event) => setAnnualFee(event.target.value)}
                placeholder="Ex. 180 €"
                maxLength={40}
              />
            </FormField>
          </>
        ) : null}

        <FormField label="Jour">
          <FormSelect value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)}>
            {DAY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FormSelect>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Début">
            <FormInput
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              required
            />
          </FormField>
          <FormField label="Fin">
            <FormInput
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              required
            />
          </FormField>
        </div>

        <FormField label="Lieu (facultatif)">
          <FormInput
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Ex. Salle des fêtes"
            maxLength={100}
          />
        </FormField>
        <FormField label="Coach ou intervenant (facultatif)">
          <FormInput
            value={teacherName}
            onChange={(event) => setTeacherName(event.target.value)}
            list="planning-teacher-suggestions"
            maxLength={100}
          />
          <datalist id="planning-teacher-suggestions">
            {teacherSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </FormField>

        <div className="flex flex-col gap-3 sm:col-span-2">
          <StatusMessage feedback={feedback} />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onCancel} disabled={busy} className="btn btn-ghost btn-sm">
              Annuler
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
              {busy ? "Ajout en cours…" : "Ajouter le créneau"}
            </button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        title={isNew ? "Créer une nouvelle activité ?" : "Réactiver cette activité ?"}
        message={
          isNew ? (
            <>
              <p>
                L’activité <strong>« {newName.trim()} »</strong> sera créée et ajoutée au site et au
                bulletin d’adhésion, avec ce créneau.
              </p>
              <p className="mt-2">
                Vérifiez l’orthographe : une faute de frappe créerait une activité en double.
              </p>
            </>
          ) : (
            <p>
              L’activité <strong>« {chosen?.name} »</strong> est actuellement désactivée. Elle
              réapparaîtra sur le site avec ce créneau.
            </p>
          )
        }
        confirmLabel={isNew ? "Oui, créer l’activité" : "Oui, réactiver"}
        busy={busy}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
