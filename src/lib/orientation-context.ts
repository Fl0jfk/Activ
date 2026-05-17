import type { ClubData } from "@/lib/club-data";
import { buildMistralActivitiesContext } from "@/lib/schedule-week";
import type { AssociationData } from "@/lib/site-data-types";

function countSlotRegistrations(clubData: ClubData, slotId: string): number {
  return clubData.applications.filter(
    (entry) => entry.trialSlotId === slotId && entry.status !== "rejected",
  ).length;
}

export function buildOrientationContext(
  siteData: AssociationData,
  clubData: ClubData,
  reference = new Date(),
): string {
  const now = Date.now();
  const disciplineById = new Map(siteData.disciplines.map((d) => [d.id, d]));

  const activites = JSON.parse(buildMistralActivitiesContext(siteData, reference)) as Record<
    string,
    unknown
  >[];

  const activitesEnrichies = activites.map((entry) => {
    const nom = typeof entry.nom === "string" ? entry.nom : "";
    const discipline = siteData.disciplines.find((d) => d.active && d.name === nom);
    return {
      ...entry,
      slug: discipline?.slug ?? null,
      essaiAutorise: discipline?.allowTrialRequest ?? false,
      lienPreinscription: discipline ? `/preinscription?discipline=${discipline.slug}` : "/preinscription",
    };
  });

  const seancesEssai = clubData.trialSlots
    .filter((slot) => slot.active && new Date(slot.startsAt).getTime() >= now)
    .map((slot) => {
      const discipline = disciplineById.get(slot.disciplineId);
      const registered = countSlotRegistrations(clubData, slot.id);
      const placesRestantes = Math.max(0, slot.capacity - registered);
      return {
        id: slot.id,
        disciplineNom: discipline?.name ?? "Inconnue",
        disciplineSlug: discipline?.slug ?? null,
        essaiAutorise: discipline?.allowTrialRequest ?? false,
        titre: slot.title,
        dateHeure: slot.startsAt,
        placesRestantes,
        complet: placesRestantes === 0,
        lienReservation:
          discipline?.allowTrialRequest && discipline.slug
            ? `/disciplines/${discipline.slug}/essai`
            : null,
      };
    })
    .sort((a, b) => String(a.dateHeure).localeCompare(String(b.dateHeure)));

  const payload = {
    pages: {
      contact: "/contact",
      preinscription: "/preinscription",
    },
    emailAssociation: siteData.association.contactEmail,
    activites: activitesEnrichies,
    seancesEssaiDisponibles: seancesEssai,
    consigneInterne:
      "Les creneauxCetteSemaine sont le planning regulier des cours inscrits ; ne jamais inviter a y participer sans inscription payee.",
  };

  return JSON.stringify(payload, null, 2);
}
