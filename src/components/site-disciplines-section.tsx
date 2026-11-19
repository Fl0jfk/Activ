"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Badge, ConfirmDialog, EmptyState, SectionCard, type Feedback } from "@/components/bureau-ui";
import { SaveBar } from "@/components/site-content-ui";
import SiteImageField from "@/components/site-image-field";
import { randomId } from "@/lib/ids";
import { DAY_LABELS, type DayOfWeek } from "@/lib/schedule-constants";
import { slugify } from "@/lib/slug";
import type { AssociationData, Discipline, ScheduleSlot } from "@/lib/site-data-types";
import { saveSiteSections, type SiteSections } from "@/lib/use-site-data";
import { useBeforeUnloadWarning } from "@/lib/use-unsaved-warning";

const DAY_OPTIONS = (Object.entries(DAY_LABELS) as [string, string][]).map(([value, label]) => ({
  value: Number(value) as DayOfWeek,
  label,
}));

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slotCountLabel(count: number): string {
  return count === 0 ? "Aucun horaire" : count === 1 ? "1 horaire" : `${count} horaires`;
}

function effectiveSlug(discipline: Discipline): string {
  return slugify(discipline.slug) || slugify(discipline.name);
}

/**
 * Champ « une ligne = un élément ». Le texte brut est conservé tel quel pendant la saisie
 * (sinon la touche Entrée serait avalée) ; le parent reçoit la liste nettoyée.
 */
function LinesField({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint = "Une ligne par élément.",
}: {
  label: string;
  value: string[];
  onChange: (lines: string[]) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const [text, setText] = useState(() => value.join("\n"));
  return (
    <label className="field-label">
      {label}
      <textarea
        className="field"
        rows={rows}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
          onChange(linesToArray(event.target.value));
        }}
      />
      <span className="mt-1 block text-sm font-normal text-slate-600">{hint}</span>
    </label>
  );
}

function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-brand-line pt-5">
      <h4 className="text-base font-extrabold text-slate-900">{title}</h4>
      <div className="mt-3">{children}</div>
    </div>
  );
}

type Props = {
  data: AssociationData;
  onSaved: (saved: SiteSections) => void;
};

/** Onglet « Disciplines et horaires ». N’envoie que `disciplines` et `schedule`. */
export function DisciplinesSettingsSection({ data, onSaved }: Props) {
  const [disciplines, setDisciplines] = useState<Discipline[]>(data.disciplines);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(data.schedule);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ disciplines: data.disciplines, schedule: data.schedule }));
  const [openId, setOpenId] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<Discipline | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const idPrefix = useId();

  const dirty = JSON.stringify({ disciplines, schedule }) !== baseline;
  useBeforeUnloadWarning(dirty);

  function touch() {
    setFeedback(null);
  }

  function updateDiscipline(disciplineId: string, patch: Partial<Discipline>) {
    setDisciplines((previous) =>
      previous.map((discipline) => (discipline.id === disciplineId ? { ...discipline, ...patch } : discipline)),
    );
    touch();
  }

  function updateSlot(slotId: string, patch: Partial<ScheduleSlot>) {
    setSchedule((previous) => previous.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)));
    touch();
  }

  function addSlot(disciplineId: string) {
    setSchedule((previous) => [
      ...previous,
      {
        id: randomId("slot"),
        disciplineId,
        teacherName: "",
        day: DAY_LABELS[1],
        dayOfWeek: 1,
        startTime: "",
        endTime: "",
        location: "",
        active: true,
      },
    ]);
    touch();
  }

  function addDiscipline() {
    const created: Discipline = {
      id: randomId("discipline"),
      name: "",
      slug: "",
      description: "",
      teacher: "",
      teachers: [],
      coachBio: "",
      coachPhotoUrl: "/logo.png",
      imageUrl: "/logo.png",
      galleryImages: [],
      whatToBring: [],
      providedItems: [],
      priceInfo: "",
      annualFee: "",
      contactEmail: data.association.contactEmail,
      ctaText: "Demander un essai",
      allowTrialRequest: true,
      highlights: [],
      active: true,
    };
    setDisciplines((previous) => [...previous, created]);
    setNewIds((previous) => [...previous, created.id]);
    setOpenId(created.id);
    touch();
  }

  function confirmDelete() {
    if (!toDelete) return;
    const removedId = toDelete.id;
    setDisciplines((previous) => previous.filter((discipline) => discipline.id !== removedId));
    setSchedule((previous) => previous.filter((slot) => slot.disciplineId !== removedId));
    if (openId === removedId) setOpenId(null);
    setToDelete(null);
    setFeedback({
      tone: "info",
      text: "Discipline retirée de la liste. Cliquez sur « Enregistrer » pour confirmer la suppression.",
    });
  }

  function reset() {
    const saved = JSON.parse(baseline) as { disciplines: Discipline[]; schedule: ScheduleSlot[] };
    setDisciplines(saved.disciplines);
    setSchedule(saved.schedule);
    setNewIds([]);
    setOpenId(null);
    setResetKey((value) => value + 1);
    setFeedback(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const unnamed = disciplines.find((discipline) => !discipline.name.trim());
    if (unnamed) {
      setOpenId(unnamed.id);
      setFeedback({ tone: "error", text: "Chaque discipline doit avoir un nom. Complétez la discipline ouverte." });
      return;
    }
    const seenSlugs = new Map<string, Discipline>();
    for (const discipline of disciplines) {
      const slug = effectiveSlug(discipline);
      const other = seenSlugs.get(slug);
      if (other) {
        setOpenId(discipline.id);
        setFeedback({
          tone: "error",
          text: `Les disciplines « ${other.name.trim()} » et « ${discipline.name.trim()} » ont la même adresse web. Changez-la dans « Avancé » de l’une des deux.`,
        });
        return;
      }
      seenSlugs.set(slug, discipline);
    }

    setSaving(true);
    setFeedback(null);
    try {
      const result = await saveSiteSections({ disciplines, schedule });
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        return;
      }
      const savedDisciplines = result.saved.disciplines ?? disciplines;
      const savedSchedule = result.saved.schedule ?? schedule;
      setDisciplines(savedDisciplines);
      setSchedule(savedSchedule);
      setBaseline(JSON.stringify({ disciplines: savedDisciplines, schedule: savedSchedule }));
      setNewIds([]);
      onSaved({ disciplines: savedDisciplines, schedule: savedSchedule });
      setFeedback({ tone: "success", text: "Disciplines et horaires enregistrés." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <fieldset disabled={saving} className="min-w-0">
        <SectionCard
          title="Disciplines et horaires"
          description="Cliquez sur une discipline pour la modifier. Les changements sont publiés sur le site quand vous cliquez sur « Enregistrer »."
          action={
            <button type="button" onClick={addDiscipline} className="btn btn-outline">
              Ajouter une discipline
            </button>
          }
        >
          {disciplines.length === 0 ? (
            <EmptyState>Aucune discipline pour le moment. Cliquez sur « Ajouter une discipline ».</EmptyState>
          ) : (
            <ul className="space-y-3">
              {disciplines.map((discipline, index) => {
                const isOpen = openId === discipline.id;
                const slots = schedule.filter((slot) => slot.disciplineId === discipline.id);
                const isNew = newIds.includes(discipline.id);
                const panelId = `${idPrefix}-${discipline.id}`;
                const displayName = discipline.name.trim() || `Discipline ${index + 1}`;
                return (
                  <li key={`${discipline.id}-${resetKey}`} className="rounded-2xl border border-brand-line bg-white">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : discipline.id)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex min-h-16 w-full flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-brand-cream/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                    >
                      <span className="min-w-0">
                        <span className="text-break block text-lg font-bold text-slate-900">
                          {discipline.name.trim() || "Nouvelle discipline (nom à renseigner)"}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-2">
                          {isNew ? <Badge tone="blue">Nouvelle</Badge> : null}
                          <Badge tone={discipline.active ? "green" : "orange"}>
                            {discipline.active ? "Visible sur le site" : "Masquée du site"}
                          </Badge>
                          <Badge tone="slate">{slotCountLabel(slots.length)}</Badge>
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brand-blue">
                        {isOpen ? "Replier" : "Modifier"}
                      </span>
                    </button>

                    {isOpen ? (
                      <div id={panelId} className="space-y-5 border-t border-brand-line px-4 pb-5 pt-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="field-label sm:col-span-2">
                            Nom de la discipline <span className="font-normal text-slate-600">(obligatoire)</span>
                            <input
                              className="field"
                              value={discipline.name}
                              onChange={(event) => {
                                const name = event.target.value;
                                // L’adresse web ne suit le nom que pour une discipline pas encore publiée.
                                updateDiscipline(discipline.id, {
                                  name,
                                  ...(isNew ? { slug: slugify(name) } : {}),
                                });
                              }}
                            />
                          </label>
                          <label className="field-label sm:col-span-2">
                            Description
                            <textarea
                              className="field"
                              rows={3}
                              value={discipline.description}
                              onChange={(event) => updateDiscipline(discipline.id, { description: event.target.value })}
                            />
                          </label>
                          <SiteImageField
                            label="Image principale de la discipline"
                            helpText="Visible sur l’accueil et sur la page de la discipline. JPEG, PNG, WebP ou GIF (5 Mo maximum)."
                            value={discipline.imageUrl}
                            onChange={(imageUrl) => updateDiscipline(discipline.id, { imageUrl })}
                            disabled={saving}
                          />
                          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-line bg-brand-cream/40 p-4 sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={discipline.active}
                              onChange={(event) => updateDiscipline(discipline.id, { active: event.target.checked })}
                              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue"
                            />
                            <span>
                              <span className="block text-sm font-bold text-slate-900">
                                Afficher cette discipline sur le site
                              </span>
                              <span className="block text-sm text-slate-600">
                                Décochez pour la masquer sans la supprimer (par exemple en dehors de la saison).
                              </span>
                            </span>
                          </label>
                        </div>

                        <SubSection title="Enseignants">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <LinesField
                              key={`teachers-${resetKey}`}
                              label="Noms des enseignants"
                              value={discipline.teachers ?? (discipline.teacher ? [discipline.teacher] : [])}
                              onChange={(teachers) =>
                                updateDiscipline(discipline.id, { teachers, teacher: teachers[0] ?? "" })
                              }
                              placeholder="Ex. Claire Martin"
                              hint="Une ligne par enseignant."
                            />
                            <label className="field-label">
                              Présentation de l’enseignant
                              <textarea
                                className="field"
                                rows={3}
                                value={discipline.coachBio}
                                onChange={(event) => updateDiscipline(discipline.id, { coachBio: event.target.value })}
                              />
                            </label>
                            <SiteImageField
                              label="Photo de l’enseignant"
                              helpText="Affichée dans la fiche de la discipline."
                              value={discipline.coachPhotoUrl ?? ""}
                              onChange={(coachPhotoUrl) => updateDiscipline(discipline.id, { coachPhotoUrl })}
                              disabled={saving}
                            />
                          </div>
                        </SubSection>

                        <SubSection title="Tarifs et inscription">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="field-label">
                              Informations sur le tarif
                              <input
                                className="field"
                                value={discipline.priceInfo}
                                onChange={(event) => updateDiscipline(discipline.id, { priceInfo: event.target.value })}
                              />
                            </label>
                            <label className="field-label">
                              Licence à l’année
                              <input
                                className="field"
                                value={discipline.annualFee ?? ""}
                                onChange={(event) => updateDiscipline(discipline.id, { annualFee: event.target.value })}
                                placeholder="Ex. 180 € par an"
                              />
                            </label>
                            <label className="field-label">
                              Adresse e-mail de contact de la discipline
                              <input
                                type="email"
                                inputMode="email"
                                autoComplete="off"
                                className="field"
                                value={discipline.contactEmail}
                                onChange={(event) => updateDiscipline(discipline.id, { contactEmail: event.target.value })}
                              />
                            </label>
                            <label className="field-label">
                              Texte du bouton « cours d’essai »
                              <input
                                className="field"
                                value={discipline.ctaText}
                                onChange={(event) => updateDiscipline(discipline.id, { ctaText: event.target.value })}
                              />
                            </label>
                            <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
                              <input
                                type="checkbox"
                                checked={discipline.allowTrialRequest}
                                onChange={(event) =>
                                  updateDiscipline(discipline.id, { allowTrialRequest: event.target.checked })
                                }
                                className="h-5 w-5 shrink-0 accent-brand-blue"
                              />
                              <span className="text-sm font-semibold text-slate-800">
                                Permettre de demander un cours d’essai
                              </span>
                            </label>
                          </div>
                        </SubSection>

                        <SubSection title="Matériel">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <LinesField
                              key={`bring-${resetKey}`}
                              label="Matériel à apporter"
                              value={discipline.whatToBring}
                              rows={4}
                              onChange={(whatToBring) => updateDiscipline(discipline.id, { whatToBring })}
                              hint="Une ligne par élément."
                            />
                            <LinesField
                              key={`provided-${resetKey}`}
                              label="Matériel fourni"
                              value={discipline.providedItems}
                              rows={4}
                              onChange={(providedItems) => updateDiscipline(discipline.id, { providedItems })}
                              hint="Une ligne par élément."
                            />
                          </div>
                        </SubSection>

                        <SubSection title="Horaires">
                          {slots.length === 0 ? (
                            <p className="text-sm text-slate-600">Aucun horaire pour cette discipline.</p>
                          ) : (
                            <ul className="space-y-3">
                              {slots.map((slot) => {
                                const startInvalid = Boolean(slot.startTime) && !TIME_PATTERN.test(slot.startTime);
                                const endInvalid = Boolean(slot.endTime) && !TIME_PATTERN.test(slot.endTime);
                                const endBeforeStart =
                                  !startInvalid &&
                                  !endInvalid &&
                                  Boolean(slot.startTime) &&
                                  Boolean(slot.endTime) &&
                                  slot.endTime <= slot.startTime;
                                const teachers = discipline.teachers ?? [];
                                return (
                                  <li key={slot.id} className="rounded-2xl border border-brand-line bg-brand-cream/40 p-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <label className="field-label">
                                        Jour
                                        <select
                                          className="field"
                                          value={slot.dayOfWeek}
                                          onChange={(event) => {
                                            const dayOfWeek = Number(event.target.value) as DayOfWeek;
                                            updateSlot(slot.id, { dayOfWeek, day: DAY_LABELS[dayOfWeek] });
                                          }}
                                        >
                                          {DAY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="field-label">
                                        Lieu
                                        <input
                                          className="field"
                                          value={slot.location}
                                          onChange={(event) => updateSlot(slot.id, { location: event.target.value })}
                                          placeholder="Ex. Salle des fêtes"
                                        />
                                      </label>
                                      <label className="field-label">
                                        Heure de début
                                        <input
                                          type="time"
                                          className="field"
                                          value={TIME_PATTERN.test(slot.startTime) ? slot.startTime : ""}
                                          onChange={(event) => updateSlot(slot.id, { startTime: event.target.value })}
                                          aria-invalid={startInvalid}
                                        />
                                        {startInvalid ? (
                                          <span className="mt-1 block text-sm font-semibold text-amber-800">
                                            Horaire enregistré « {slot.startTime} » : choisissez l’heure pour le corriger.
                                          </span>
                                        ) : null}
                                      </label>
                                      <label className="field-label">
                                        Heure de fin
                                        <input
                                          type="time"
                                          className="field"
                                          value={TIME_PATTERN.test(slot.endTime) ? slot.endTime : ""}
                                          onChange={(event) => updateSlot(slot.id, { endTime: event.target.value })}
                                          aria-invalid={endInvalid || endBeforeStart}
                                        />
                                        {endInvalid ? (
                                          <span className="mt-1 block text-sm font-semibold text-amber-800">
                                            Horaire enregistré « {slot.endTime} » : choisissez l’heure pour le corriger.
                                          </span>
                                        ) : null}
                                        {endBeforeStart ? (
                                          <span className="mt-1 block text-sm font-semibold text-amber-800">
                                            Vérifiez : la fin est avant le début.
                                          </span>
                                        ) : null}
                                      </label>
                                      <label className="field-label sm:col-span-2">
                                        Enseignant
                                        <select
                                          className="field"
                                          value={slot.teacherName ?? ""}
                                          onChange={(event) => updateSlot(slot.id, { teacherName: event.target.value })}
                                        >
                                          <option value="">À définir</option>
                                          {slot.teacherName && !teachers.includes(slot.teacherName) ? (
                                            <option value={slot.teacherName}>{slot.teacherName} (à vérifier)</option>
                                          ) : null}
                                          {teachers.map((teacher) => (
                                            <option key={teacher} value={teacher}>
                                              {teacher}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSchedule((previous) => previous.filter((entry) => entry.id !== slot.id));
                                          touch();
                                        }}
                                        className="btn btn-ghost btn-sm border-rose-200 text-rose-700 hover:bg-rose-50"
                                        aria-label={`Supprimer cet horaire (${DAY_LABELS[slot.dayOfWeek]}${slot.startTime ? ` ${slot.startTime}` : ""}) de ${displayName}`}
                                      >
                                        Supprimer cet horaire
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <button
                            type="button"
                            onClick={() => addSlot(discipline.id)}
                            className="btn btn-outline btn-sm mt-3"
                          >
                            Ajouter un horaire
                          </button>
                        </SubSection>

                        <SubSection title="Avancé">
                          <label className="field-label">
                            Adresse web de la page de la discipline
                            <input
                              className="field"
                              value={discipline.slug}
                              onChange={(event) => updateDiscipline(discipline.id, { slug: slugify(event.target.value) })}
                              placeholder="Ex. tennis-de-table"
                            />
                            <span className="mt-1 block text-sm font-normal text-slate-600">
                              Page : /disciplines/{effectiveSlug(discipline) || "…"}. Pour une discipline déjà en ligne,
                              la modifier change le lien de la page.
                            </span>
                          </label>
                        </SubSection>

                        <div className="flex justify-end border-t border-brand-line pt-5">
                          <button
                            type="button"
                            onClick={() => setToDelete(discipline)}
                            className="btn btn-ghost btn-sm border-rose-200 text-rose-700 hover:bg-rose-50"
                          >
                            Supprimer cette discipline
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </fieldset>

      <SaveBar
        dirty={dirty}
        saving={saving}
        primaryLabel="Enregistrer"
        secondaryLabel={dirty ? "Annuler les modifications" : undefined}
        onSecondary={reset}
        feedback={feedback}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer cette discipline ?"
        message={
          <>
            « {toDelete?.name.trim() || "Cette discipline"} » sera retirée de la liste avec ses horaires. Les
            actualités qui lui étaient liées passeront en « Toute l’association ». La suppression sera définitive
            quand vous cliquerez sur « Enregistrer ».
          </>
        }
        confirmLabel="Retirer la discipline"
        cancelLabel="Garder la discipline"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </form>
  );
}
