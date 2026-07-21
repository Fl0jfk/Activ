"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AssociationData, Discipline, ScheduleSlot } from "@/lib/site-data-types";
import { DAY_LABELS, type DayOfWeek } from "@/lib/schedule-constants";
import { randomId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import SiteImageField from "@/components/site-image-field";

const DAY_OPTIONS = (Object.entries(DAY_LABELS) as [string, string][]).map(([value, label]) => ({
  value: Number(value) as DayOfWeek,
  label,
}));

const emptyData: AssociationData = {
  association: {
    name: "",
    tagline: "",
    city: "",
    contactEmail: "",
    facebookUrl: "",
    address: "",
    organisation: {
      boardMembers: [],
      notes: "",
    },
  },
  news: [],
  disciplines: [],
  schedule: [],
  scheduleExceptions: [],
};

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: string[]): string {
  return value.join("\n");
}

export default function AdminDashboardPage({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<AssociationData>(emptyData);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);
  const [openDisciplineId, setOpenDisciplineId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage("");

    const response = await fetch("/api/admin/site-data");

    if (!response.ok) {
      setIsForbidden(response.status === 401);
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as AssociationData;
    setData(payload);
    setHasAccess(true);
    setIsForbidden(false);
    setStatusMessage("Donnees chargees.");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function saveData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setStatusMessage("");

    const response = await fetch("/api/admin/site-data", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      setStatusMessage("Enregistrement impossible.");
      setIsLoading(false);
      return;
    }

    setStatusMessage("Mise a jour enregistree.");
    setIsLoading(false);
  }

  function updateDiscipline(index: number, nextValue: Partial<Discipline>) {
    setData((previous) => {
      const disciplines = [...previous.disciplines];
      disciplines[index] = { ...disciplines[index], ...nextValue };
      return { ...previous, disciplines };
    });
  }

  function updateSchedule(slotId: string, nextValue: Partial<ScheduleSlot>) {
    setData((previous) => {
      const schedule = previous.schedule.map((slot) =>
        slot.id === slotId ? { ...slot, ...nextValue } : slot
      );
      return { ...previous, schedule };
    });
  }

  function addScheduleForDiscipline(disciplineId: string) {
    setData((previous) => ({
      ...previous,
      schedule: [
        ...previous.schedule,
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
      ],
    }));
  }

  function removeSchedule(slotId: string) {
    setData((previous) => ({
      ...previous,
      schedule: previous.schedule.filter((slot) => slot.id !== slotId),
    }));
  }

  function updateBoardMember(index: number, next: { fullName?: string; role?: string; email?: string }) {
    setData((previous) => {
      const boardMembers = [...previous.association.organisation.boardMembers];
      boardMembers[index] = { ...boardMembers[index], ...next };
      return {
        ...previous,
        association: {
          ...previous.association,
          organisation: { ...previous.association.organisation, boardMembers },
        },
      };
    });
  }

  function addBoardMember() {
    setData((previous) => ({
      ...previous,
      association: {
        ...previous.association,
        organisation: {
          ...previous.association.organisation,
          boardMembers: [
            ...previous.association.organisation.boardMembers,
            { id: randomId("board"), fullName: "", role: "", email: "" },
          ],
        },
      },
    }));
  }

  if (!hasAccess) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        <div className="mx-auto mt-20 w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-slate-700">
            {isLoading
              ? "Verification des droits..."
              : isForbidden
                ? "Accès réservé au rôle direction."
                : "Verification..."}
          </p>
        </div>
      </main>
    );
  }

  const Wrapper = embedded ? "div" : "main";
  const wrapperClass = embedded ? "space-y-6" : "mx-auto w-full max-w-6xl px-4 py-8 sm:px-8";

  return (
    <Wrapper className={wrapperClass}>
      {!embedded ? (
        <>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard administration</h1>
          <p className="mt-2 text-slate-700">
            Informations générales, organigramme et disciplines.
          </p>
        </>
      ) : null}

      <form onSubmit={saveData} className={embedded ? "space-y-6" : "mt-6 space-y-6"}>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Informations generales</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nom de l&apos;association
              <input
                value={data.association.name}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, association: { ...prev.association, name: event.target.value } }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                placeholder="Nom de l'association"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Ville
              <input
                value={data.association.city}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, association: { ...prev.association, city: event.target.value } }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                placeholder="Ville"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Email de contact
              <input
                value={data.association.contactEmail}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    association: { ...prev.association, contactEmail: event.target.value },
                  }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                placeholder="Email de contact"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Lien Facebook
              <input
                value={data.association.facebookUrl}
                onChange={(event) =>
                  setData((prev) => ({
                    ...prev,
                    association: { ...prev.association, facebookUrl: event.target.value },
                  }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                placeholder="Lien Facebook"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
              Adresse
              <input
                value={data.association.address}
                onChange={(event) =>
                  setData((prev) => ({ ...prev, association: { ...prev.association, address: event.target.value } }))
                }
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                placeholder="Adresse"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Organigramme (bureau)</h2>
            <button
              type="button"
              onClick={addBoardMember}
              className="rounded-xl border border-slate-300 px-3 py-1 text-sm font-semibold"
            >
              Ajouter un membre
            </button>
          </div>
          <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-slate-700">
            Note d&apos;organigramme
            <textarea
              value={data.association.organisation.notes}
              onChange={(event) =>
                setData((prev) => ({
                  ...prev,
                  association: {
                    ...prev.association,
                    organisation: { ...prev.association.organisation, notes: event.target.value },
                  },
                }))
              }
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              rows={2}
            />
          </label>
          <div className="mt-4 space-y-3">
            {data.association.organisation.boardMembers.map((member, index) => (
              <div key={member.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-3">
                <input
                  value={member.fullName}
                  onChange={(event) => updateBoardMember(index, { fullName: event.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Nom complet"
                />
                <input
                  value={member.role}
                  onChange={(event) => updateBoardMember(index, { role: event.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Role"
                />
                <input
                  value={member.email}
                  onChange={(event) => updateBoardMember(index, { email: event.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Email"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Disciplines (pages dynamiques)</h2>
            <button
              type="button"
              onClick={() =>
                setData((prev) => ({
                  ...prev,
                  disciplines: [
                    ...prev.disciplines,
                    {
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
                      contactEmail: prev.association.contactEmail,
                      ctaText: "Demander un essai",
                      allowTrialRequest: true,
                      highlights: [],
                      active: true,
                    },
                  ],
                }))
              }
              className="rounded-xl border border-slate-300 px-3 py-1 text-sm font-semibold"
            >
              Ajouter
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {data.disciplines.map((discipline, index) => {
              const isOpen = openDisciplineId === discipline.id;
              const disciplineSchedule = data.schedule.filter((slot) => slot.disciplineId === discipline.id);
              return (
              <article key={discipline.id} className="rounded-xl border border-slate-200 p-4">
                <button
                  type="button"
                  onClick={() => setOpenDisciplineId(isOpen ? null : discipline.id)}
                  className="flex w-full items-center justify-between gap-4 text-left"
                >
                  <h3 className="text-base font-semibold text-slate-900">
                    {discipline.name || `Discipline ${index + 1}`}
                  </h3>
                  <span className="text-sm font-medium text-cyan-700">{isOpen ? "Replier" : "Ouvrir"}</span>
                </button>
                {isOpen ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Nom de la discipline
                    <input
                      value={discipline.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        updateDiscipline(index, {
                          name,
                          slug: discipline.slug ? discipline.slug : slugify(name),
                        });
                      }}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      placeholder="Nom"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Slug URL
                    <input
                      value={discipline.slug}
                      onChange={(event) => updateDiscipline(index, { slug: slugify(event.target.value) })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      placeholder="Slug URL"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Enseignants (1 ligne = 1 enseignant)
                    <textarea
                      value={arrayToLines(discipline.teachers ?? (discipline.teacher ? [discipline.teacher] : []))}
                      onChange={(event) => {
                        const teachers = linesToArray(event.target.value);
                        updateDiscipline(index, { teachers, teacher: teachers[0] ?? "" });
                      }}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      rows={3}
                      placeholder="Ex: Claire Martin"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Email de contact discipline
                    <input
                      value={discipline.contactEmail}
                      onChange={(event) => updateDiscipline(index, { contactEmail: event.target.value })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      placeholder="Email de contact discipline"
                    />
                  </label>
                  <SiteImageField
                    label="Image principale de la discipline"
                    helpText="Visible sur l'accueil et la page de la discipline. JPEG, PNG, WebP ou GIF (max 5 Mo)."
                    value={discipline.imageUrl}
                    onChange={(imageUrl) => updateDiscipline(index, { imageUrl })}
                    disabled={isLoading}
                  />
                  <SiteImageField
                    label="Photo du coach"
                    helpText="Affichée dans la fiche discipline."
                    value={discipline.coachPhotoUrl ?? ""}
                    onChange={(coachPhotoUrl) => updateDiscipline(index, { coachPhotoUrl })}
                    disabled={isLoading}
                  />
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                    Description
                    <textarea
                      value={discipline.description}
                      onChange={(event) => updateDiscipline(index, { description: event.target.value })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      rows={2}
                      placeholder="Description"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                    Bio du coach
                    <textarea
                      value={discipline.coachBio}
                      onChange={(event) => updateDiscipline(index, { coachBio: event.target.value })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      rows={2}
                      placeholder="Bio coach"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                    Infos tarif
                    <input
                      value={discipline.priceInfo}
                      onChange={(event) => updateDiscipline(index, { priceInfo: event.target.value })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      placeholder="Infos tarif"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                    Licence a l&apos;annee
                    <input
                      value={discipline.annualFee ?? ""}
                      onChange={(event) => updateDiscipline(index, { annualFee: event.target.value })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      placeholder="Ex: 180 EUR / an"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Materiel a apporter
                    <textarea
                      value={arrayToLines(discipline.whatToBring)}
                      onChange={(event) => updateDiscipline(index, { whatToBring: linesToArray(event.target.value) })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      rows={4}
                      placeholder="1 ligne = 1 item"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Materiel fourni
                    <textarea
                      value={arrayToLines(discipline.providedItems)}
                      onChange={(event) => updateDiscipline(index, { providedItems: linesToArray(event.target.value) })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      rows={4}
                      placeholder="1 ligne = 1 item"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
                    Texte du bouton d&apos;essai
                    <input
                      value={discipline.ctaText}
                      onChange={(event) => updateDiscipline(index, { ctaText: event.target.value })}
                      className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                      placeholder="Texte bouton essai"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Horaires de cette discipline</p>
                      <button
                        type="button"
                        onClick={() => addScheduleForDiscipline(discipline.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold"
                      >
                        Ajouter un horaire
                      </button>
                    </div>
                    <div className="space-y-2">
                      {disciplineSchedule.length > 0 ? (
                        disciplineSchedule.map((slot) => (
                          <div key={slot.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                                Jour
                                <select
                                  value={slot.dayOfWeek}
                                  onChange={(event) => {
                                    const dayOfWeek = Number(event.target.value) as DayOfWeek;
                                    updateSchedule(slot.id, {
                                      dayOfWeek,
                                      day: DAY_LABELS[dayOfWeek],
                                    });
                                  }}
                                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                                >
                                  {DAY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                                Lieu
                                <input
                                  value={slot.location}
                                  onChange={(event) => updateSchedule(slot.id, { location: event.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                                  placeholder="Lieu"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                                Enseignant
                                <select
                                  value={slot.teacherName ?? ""}
                                  onChange={(event) => updateSchedule(slot.id, { teacherName: event.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                                >
                                  <option value="">A definir</option>
                                  {(discipline.teachers ?? []).map((teacher) => (
                                    <option key={teacher} value={teacher}>
                                      {teacher}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                                Heure debut
                                <input
                                  value={slot.startTime}
                                  onChange={(event) => updateSchedule(slot.id, { startTime: event.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                                  placeholder="Ex: 10:00"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                                Heure fin
                                <input
                                  value={slot.endTime}
                                  onChange={(event) => updateSchedule(slot.id, { endTime: event.target.value })}
                                  className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
                                  placeholder="Ex: 11:00"
                                />
                              </label>
                            </div>
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeSchedule(slot.id)}
                                className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700"
                              >
                                Supprimer cet horaire
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-600">Aucun horaire pour cette discipline.</p>
                      )}
                    </div>
                  </div>
                </div> : null}
              </article>
            );
            })}
          </div>
        </section>

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-cyan-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          Enregistrer
        </button>
      </form>

      {statusMessage ? (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{statusMessage}</p>
      ) : null}
    </Wrapper>
  );
}
