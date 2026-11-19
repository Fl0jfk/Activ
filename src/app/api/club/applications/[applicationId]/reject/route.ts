import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { actorName, readJsonBody, rejectionResponse } from "@/lib/application-route-utils";
import { isPresident } from "@/lib/clerk";
import { updateClubData } from "@/lib/club-data";
import type { RegistrationApplication } from "@/lib/club-data";
import {
  TransitionRejection,
  applyReject,
  isClosedApplication,
  planReject,
} from "@/lib/dossier-transitions";
import { claimLifecycleEmail, queueLifecycleEmail } from "@/lib/lifecycle-emails";
import {
  removeClerkAccountForRejection,
  syncClerkForApplication,
} from "@/lib/registration-clerk-sync";

type RejectOutcome = {
  application: RegistrationApplication;
  mine: RegistrationApplication[];
  clerkUserId: string | null;
  hasOtherActiveDossier: boolean;
  mode: "reject" | "retry";
  sendEmail: boolean;
  paymentCancelled: boolean;
};

/**
 * Refus d'un dossier. Corps JSON facultatif : `reason` (motif, transmis à l'adhérent par e-mail) et
 * `force` (obligatoire pour refuser un dossier finalisé et payé, réservé au président).
 *
 * Choix pour le compte de connexion : un REFUS supprime le compte (la personne peut ensuite se
 * réinscrire avec la même adresse e-mail) sauf s'il s'agit du compte de l'utilisateur, d'un compte
 * bureau/coach ou si la personne a un autre dossier actif. Si la suppression échoue, l'accès est au
 * moins fermé (espaceValidated = false) et lien et avertissement sont conservés. Une DÉSINSCRIPTION
 * (PATCH status = cancelled) ne supprime jamais le compte : elle ferme l'accès et la personne peut se
 * reconnecter pour déposer une nouvelle pré-inscription.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ applicationId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }
  const currentUser = auth.value;
  const actor = actorName(currentUser);

  const body = await readJsonBody(request);
  const options =
    body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const reason = typeof options.reason === "string" ? options.reason.trim().slice(0, 500) : "";
  const force = options.force === true;

  try {
    const { applicationId } = await context.params;

    const outcome = await updateClubData<RejectOutcome>((data) => {
      const application = data.applications.find((entry) => entry.id === applicationId);
      if (!application) {
        throw new TransitionRejection("Demande introuvable.", 404);
      }
      const mode = planReject(application, { force, actorIsPresident: isPresident(currentUser) });
      let paymentCancelled = false;
      let sendEmail = false;
      if (mode === "reject") {
        paymentCancelled = applyReject(data, application, { reason, force }, { actor }).paymentCancelled;
        sendEmail = claimLifecycleEmail(application, "rejected");
      }
      const clerkUserId = application.clerkUserId;
      const mine = data.applications.filter(
        (entry) => clerkUserId !== null && entry.clerkUserId === clerkUserId,
      );
      return {
        application: structuredClone(application),
        mine: structuredClone(mine),
        clerkUserId,
        hasOtherActiveDossier: mine.some(
          (entry) => entry.id !== application.id && !isClosedApplication(entry),
        ),
        mode,
        sendEmail,
        paymentCancelled,
      };
    });

    /* Le refus est enregistré : la suite ne peut plus faire échouer la requête. */
    const warnings: string[] = [];
    let accountDeleted = false;
    let accountKept = false;

    if (outcome.clerkUserId) {
      const removal = await removeClerkAccountForRejection({
        clerkUserId: outcome.clerkUserId,
        actorUserId: currentUser.userId,
        hasOtherActiveDossier: outcome.hasOtherActiveDossier,
      });
      if (removal.warning) warnings.push(removal.warning);
      accountDeleted = removal.deleted;
      accountKept = removal.kept === "other_dossier";

      if (removal.deleted) {
        const clerkUserId = outcome.clerkUserId;
        try {
          await updateClubData((data) => {
            for (const entry of data.applications) {
              if (entry.clerkUserId === clerkUserId) entry.clerkUserId = null;
            }
            data.members = data.members.filter((entry) => entry.clerkUserId !== clerkUserId);
          });
        } catch (error) {
          console.error("Unable to detach deleted account from applications", { clerkUserId, error });
          warnings.push(
            "Le compte de connexion est supprimé, mais le lien avec le dossier n’a pas pu être retiré.",
          );
        }
      } else {
        // Compte conservé : l'accès est recalculé d'après les dossiers restants (fermé s'il n'en reste aucun d'actif).
        const sync = await syncClerkForApplication(outcome.application, { applications: outcome.mine });
        if (!sync.ok) warnings.push(sync.warning);
      }
    }

    if (outcome.sendEmail) {
      queueLifecycleEmail("rejected", outcome.application);
    }

    const parts: string[] = [];
    if (outcome.mode === "retry") {
      parts.push(
        accountDeleted
          ? "Le compte de connexion a été supprimé."
          : "Le compte de connexion n’a pas pu être supprimé.",
      );
    } else {
      parts.push(
        outcome.clerkUserId && accountDeleted
          ? "Dossier refusé. L’accès de l’adhérent à son espace a été supprimé."
          : "Dossier refusé.",
      );
    }
    if (accountKept) {
      parts.push("L’adhérent garde son accès à l’espace : il a un autre dossier actif.");
    }
    if (outcome.paymentCancelled) {
      parts.push(
        "Le paiement enregistré est annulé : un éventuel remboursement est à traiter en dehors de l’application.",
      );
    }
    parts.push(...warnings);

    return jsonOk({
      message: parts.join(" "),
      warning: warnings.length > 0 ? warnings.join(" ") : undefined,
      clerkDeleted: accountDeleted,
      accountKept,
      paymentCancelled: outcome.paymentCancelled,
    });
  } catch (error) {
    const rejection = rejectionResponse(error);
    if (rejection) {
      return rejection;
    }
    console.error("Failed to reject application", error);
    return jsonError("Impossible de refuser le dossier. Réessayez dans un instant.", 500);
  }
}
