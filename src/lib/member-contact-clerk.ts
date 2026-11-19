import { clerkClient } from "@clerk/nextjs/server";
import { parseClerkError } from "@/lib/clerk-errors";
import type { MemberContactValues } from "@/lib/member-contact";

export type ContactClerkSyncResult =
  | { ok: true }
  | { ok: false; warning: string };

function sameAddress(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Applique l'e-mail (identifiant de connexion) et le nom au compte Clerk.
 *
 * L'adresse est d'abord créée (ou promue) comme adresse principale VÉRIFIÉE. Les anciennes adresses
 * ne sont retirées qu'ensuite, et seulement si Clerk confirme que la nouvelle est bien principale et
 * vérifiée : une faute de frappe ou un refus de Clerk ne peut donc jamais enfermer l'adhérent dehors.
 * Tout échec est signalé au bureau (`ok: false` + message), sans perdre les coordonnées du dossier.
 */
export async function syncContactToClerk(params: {
  clerkUserId: string | null;
  values: MemberContactValues;
}): Promise<ContactClerkSyncResult> {
  if (!params.clerkUserId) {
    return { ok: true };
  }

  const warnings: string[] = [];

  try {
    const client = await clerkClient();
    let user = await client.users.getUser(params.clerkUserId);
    const targetEmail = params.values.email.trim().toLowerCase();

    if (targetEmail) {
      const primaryOf = (candidate: typeof user) =>
        candidate.emailAddresses.find((entry) => entry.id === candidate.primaryEmailAddressId);

      if (!sameAddress(primaryOf(user)?.emailAddress ?? "", targetEmail)) {
        const existing = user.emailAddresses.find((entry) => sameAddress(entry.emailAddress, targetEmail));

        try {
          if (existing) {
            await client.emailAddresses.updateEmailAddress(existing.id, {
              verified: true,
              primary: true,
            });
          } else {
            await client.emailAddresses.createEmailAddress({
              userId: user.id,
              emailAddress: targetEmail,
              verified: true,
              primary: true,
            });
          }
        } catch (error) {
          console.error("Unable to set new Clerk e-mail address", error);
          const parsed = parseClerkError(error);
          return {
            ok: false,
            warning:
              parsed.status === 409
                ? "Les coordonnées du site sont enregistrées, mais cette adresse e-mail est déjà utilisée par un autre compte de connexion : l’adresse de connexion n’a pas été modifiée."
                : "Les coordonnées du site sont enregistrées, mais l’adresse de connexion n’a pas pu être mise à jour : l’ancienne adresse reste valable.",
          };
        }

        // Relecture : on ne retire les anciennes adresses que si la nouvelle est bien en place.
        user = await client.users.getUser(params.clerkUserId);
        const created = user.emailAddresses.find((entry) => sameAddress(entry.emailAddress, targetEmail));
        const confirmed =
          created !== undefined &&
          user.primaryEmailAddressId === created.id &&
          created.verification?.status === "verified";
        if (!created || !confirmed) {
          return {
            ok: false,
            warning:
              "Les coordonnées du site sont enregistrées. La nouvelle adresse de connexion a été ajoutée mais n’est pas confirmée comme adresse principale : les anciennes adresses ont été conservées pour que l’adhérent puisse toujours se connecter. Vérifiez le compte.",
          };
        }

        const notRemoved: string[] = [];
        for (const entry of user.emailAddresses) {
          if (entry.id === created.id) continue;
          try {
            await client.emailAddresses.deleteEmailAddress(entry.id);
          } catch (error) {
            console.error("Unable to delete previous Clerk email address", error);
            notRemoved.push(entry.emailAddress);
          }
        }
        if (notRemoved.length > 0) {
          warnings.push(
            `L’adresse de connexion est à jour, mais ${notRemoved.length > 1 ? "des anciennes adresses n’ont" : "une ancienne adresse n’a"} pas pu être retirée (${notRemoved.join(", ")}) : ${notRemoved.length > 1 ? "elles permettent" : "elle permet"} encore de se connecter.`,
          );
        }
      }
    }

    const nextFirstName = params.values.firstName.trim();
    const nextLastName = params.values.lastName.trim();
    if (
      nextFirstName &&
      nextLastName &&
      (user.firstName !== nextFirstName || user.lastName !== nextLastName)
    ) {
      try {
        await client.users.updateUser(user.id, {
          firstName: nextFirstName,
          lastName: nextLastName,
        });
      } catch (error) {
        console.error("Unable to update Clerk user name", error);
        warnings.push("Le nom du compte de connexion n’a pas pu être mis à jour.");
      }
    }

    return warnings.length > 0 ? { ok: false, warning: warnings.join(" ") } : { ok: true };
  } catch (error) {
    console.error("Clerk contact sync failed", error);
    return {
      ok: false,
      warning:
        "Les coordonnées du site sont enregistrées, mais l'adresse de connexion n'a pas pu être mise à jour. Vérifiez le compte de connexion.",
    };
  }
}
