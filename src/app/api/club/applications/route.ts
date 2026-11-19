import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { readJsonBody, rejectionResponse, toMemberApplicationView } from "@/lib/application-route-utils";
import { canAccessClubOperations, canAccessMemberSpace } from "@/lib/clerk";
import { readClubData, updateClubData } from "@/lib/club-data";
import type { RegistrationApplication } from "@/lib/club-data";
import { TransitionRejection, isClosedApplication } from "@/lib/dossier-transitions";
import { runInBackground } from "@/lib/lifecycle-emails";
import { notifyBureauNewPreinscription } from "@/lib/preinscription-notify";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildRegistrationApplication,
  upsertMemberForApplication,
} from "@/lib/registration-application";
import { syncClerkForApplication } from "@/lib/registration-clerk-sync";
import { isAllowedClubDocumentKey, parseS3Url } from "@/lib/s3-upload";
import { readSiteData } from "@/lib/site-data";
import { validateTrialSlotForRegistration } from "@/lib/trial-slots";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_OPEN_APPLICATIONS = 3;
const MAX_DOCUMENTS = 10;

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  const data = await readClubData();
  const admin = canAccessClubOperations(auth.value);

  if (admin) {
    return jsonOk(data.applications);
  }

  return jsonOk(
    data.applications
      .filter((entry) => entry.clerkUserId === auth.value.userId)
      .map(toMemberApplicationView),
  );
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/**
 * Seuls les fichiers envoyés par ce compte via `/api/club/documents` sont acceptés
 * (`s3://<bucket>/data/club-documents/<id du compte>/…`) : pas d'URL arbitraire dans un dossier.
 */
function validateDocuments(
  value: unknown,
  userId: string,
): RegistrationApplication["documents"] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_DOCUMENTS) return null;
  const expectedPrefix = `data/club-documents/${userId}/`;
  const bucket = process.env.BUCKET_NAME;
  const documents: RegistrationApplication["documents"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const { name, url, uploadedAt } = entry as Record<string, unknown>;
    if (typeof url !== "string") return null;
    const parsed = parseS3Url(url);
    if (
      !parsed ||
      (bucket && parsed.bucketName !== bucket) ||
      !isAllowedClubDocumentKey(parsed.key) ||
      !parsed.key.startsWith(expectedPrefix)
    ) {
      return null;
    }
    const uploaded =
      typeof uploadedAt === "string" && !Number.isNaN(new Date(uploadedAt).getTime())
        ? new Date(uploadedAt).toISOString()
        : new Date().toISOString();
    documents.push({ name: text(name, 200) || "Document", url, uploadedAt: uploaded });
  }
  return documents;
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }
  const currentUser = auth.value;

  const limit = checkRateLimit(`application-create:${currentUser.userId}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return jsonError("Trop de demandes envoyées. Patientez quelques minutes avant de réessayer.", 429);
  }

  const raw = await readJsonBody(request);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonError("Corps de requête invalide.", 400);
  }
  const payload = raw as Record<string, unknown>;

  try {
    const disciplineId = text(payload.disciplineId, 120);
    const trialSlotId = text(payload.trialSlotId, 120);
    const firstName = text(payload.firstName, 100);
    const lastName = text(payload.lastName, 100);
    const phone = text(payload.phone, 30);
    const address = text(payload.address, 200);
    const postalCode = text(payload.postalCode, 12);
    const city = text(payload.city, 100);

    if (!disciplineId || !firstName || !lastName || !phone || !address || !postalCode || !city) {
      return jsonError("Champs requis manquants.", 400);
    }

    const email = (text(payload.email, 200) || currentUser.email).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return jsonError("Adresse e-mail invalide.", 400);
    }

    const siteData = await readSiteData();
    const discipline = siteData.disciplines.find((entry) => entry.id === disciplineId);
    if (!discipline || !discipline.active) {
      return jsonError("Cette activité n’existe pas ou n’est plus proposée.", 400);
    }

    const documents = validateDocuments(payload.documents, currentUser.userId);
    if (!documents) {
      return jsonError("Un des documents joints est invalide. Ajoutez-le de nouveau.", 400);
    }

    const outcome = await updateClubData((data) => {
      const mineBefore = data.applications.filter((entry) => entry.clerkUserId === currentUser.userId);
      // Espace validé, ou titulaire d'un dossier existant (réinscription après désinscription).
      if (!canAccessMemberSpace(currentUser) && mineBefore.length === 0) {
        throw new TransitionRejection(
          "Votre espace adhérent n’est pas encore activé : le bureau doit d’abord valider votre demande.",
          403,
        );
      }

      if (trialSlotId) {
        const validation = validateTrialSlotForRegistration(data, { disciplineId, trialSlotId });
        if (!validation.ok) {
          throw new TransitionRejection(validation.message, validation.status);
        }
      }

      const open = mineBefore.filter((entry) => !isClosedApplication(entry));
      if (
        open.some(
          (entry) =>
            entry.status === "pending" &&
            entry.disciplineId === disciplineId &&
            entry.trialSlotId === (trialSlotId || null),
        )
      ) {
        throw new TransitionRejection("Vous avez déjà une demande en attente pour ce choix.", 409);
      }
      if (open.length >= MAX_OPEN_APPLICATIONS) {
        throw new TransitionRejection(
          "Vous avez déjà plusieurs demandes en cours de traitement. Contactez le bureau pour la suite.",
          409,
        );
      }

      const application = buildRegistrationApplication({
        disciplineId,
        trialSlotId: trialSlotId || null,
        firstName,
        lastName,
        phone,
        address,
        postalCode,
        city,
        email,
        motivation: text(payload.motivation, 2000),
        documents,
        clerkUserId: currentUser.userId,
      });
      data.applications.unshift(application);
      upsertMemberForApplication(data.members, currentUser, email);

      return {
        application: structuredClone(application),
        mine: structuredClone(
          data.applications.filter((entry) => entry.clerkUserId === currentUser.userId),
        ),
        trialSlots: structuredClone(data.trialSlots),
      };
    });

    runInBackground("new pre-registration notification", () =>
      notifyBureauNewPreinscription({
        application: outcome.application,
        trialSlots: outcome.trialSlots,
      }),
    );

    // Le statut d'adhésion est recalculé d'après TOUS les dossiers : une personne déjà inscrite
    // ne perd ni son accès ni son adhésion « approuvée » en redéposant une demande.
    const sync = await syncClerkForApplication(outcome.application, {
      applications: outcome.mine,
      role: currentUser.role,
    });

    return jsonOk(
      { message: "Demande envoyée.", warning: sync.ok ? undefined : sync.warning },
      201,
    );
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to create registration application", error);
    return jsonError("Erreur serveur.", 500);
  }
}
