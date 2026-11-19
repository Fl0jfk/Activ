import { NextRequest, NextResponse } from "next/server";
import { normalizeSiteData, readSiteData, writeSiteData } from "@/lib/site-data";
import {
  SITE_SECTION_KEYS,
  buildSiteDataUpdate,
  type SiteSectionKey,
  type SiteSections,
} from "@/lib/site-data-payload";
import { stripVoterHashes } from "@/lib/site-polls";
import {
  canAccessClubOperations,
  canManageSiteData as userCanManageSiteData,
  getCurrentUserContext,
} from "@/lib/clerk";

export const dynamic = "force-dynamic";

const CLUB_OPERATIONS_KEYS: readonly SiteSectionKey[] = ["scheduleExceptions"];

export async function GET() {
  const user = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  if (!canAccessClubOperations(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 403 });
  }

  try {
    const data = await readSiteData();
    // Les empreintes des votants ne servent qu’au serveur : on ne les envoie pas au navigateur.
    return NextResponse.json({ ...data, polls: data.polls.map(stripVoterHashes) });
  } catch (error) {
    console.error("Failed to read admin site data", error);
    return NextResponse.json(
      { message: "Impossible de charger les données du site." },
      { status: 500 }
    );
  }
}

/**
 * Enregistre uniquement les sections envoyées (association, disciplines, schedule,
 * scheduleExceptions, news, polls, homeGallery), fusionnées sur les données les plus récentes.
 * Le président peut écrire toutes les sections ; le bureau uniquement les annulations de séances.
 */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const isPresident = userCanManageSiteData(user);
  if (!isPresident && !canAccessClubOperations(user)) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Demande invalide." }, { status: 400 });
  }

  if (
    !isPresident &&
    typeof payload === "object" &&
    payload !== null &&
    SITE_SECTION_KEYS.some(
      (key) => !CLUB_OPERATIONS_KEYS.includes(key) && (payload as Record<string, unknown>)[key] !== undefined,
    )
  ) {
    return NextResponse.json({ message: "Non autorisé." }, { status: 403 });
  }

  try {
    // Lecture juste avant l’écriture : on part toujours des données les plus récentes.
    const current = await readSiteData();
    const result = buildSiteDataUpdate(payload, current, isPresident ? SITE_SECTION_KEYS : CLUB_OPERATIONS_KEYS);
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 });
    }

    await writeSiteData(result.value.next);

    const normalized = normalizeSiteData(result.value.next);
    const saved: SiteSections = {};
    for (const key of result.value.touched) {
      (saved as Record<string, unknown>)[key] =
        key === "polls" ? normalized.polls.map(stripVoterHashes) : normalized[key];
    }

    return NextResponse.json({
      message: isPresident ? "Données enregistrées." : "Annulations de séances enregistrées.",
      saved,
    });
  } catch (error) {
    console.error("Failed to save admin site data", error);
    return NextResponse.json({ message: "Impossible d’enregistrer les données." }, { status: 500 });
  }
}
