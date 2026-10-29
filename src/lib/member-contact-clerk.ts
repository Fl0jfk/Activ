import { clerkClient } from "@clerk/nextjs/server";
import type { MemberContactValues } from "@/lib/member-contact";

export type ContactClerkSyncResult =
  | { ok: true }
  | { ok: false; warning: string };

/**
 * Applique l'e-mail (identifiant de connexion) et le nom au compte Clerk.
 * L'adresse est marquée vérifiée par le bureau, puis les anciennes adresses
 * sont retirées pour qu'elles ne puissent plus servir à se connecter.
 */
export async function syncContactToClerk(params: {
  clerkUserId: string | null;
  values: MemberContactValues;
}): Promise<ContactClerkSyncResult> {
  if (!params.clerkUserId) {
    return { ok: true };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(params.clerkUserId);
    const targetEmail = params.values.email.trim().toLowerCase();

    if (targetEmail) {
      const currentPrimaryId = user.primaryEmailAddressId;
      const currentPrimary = user.emailAddresses.find(
        (entry) => entry.id === currentPrimaryId,
      );
      const alreadyPrimary =
        currentPrimary?.emailAddress.trim().toLowerCase() === targetEmail;

      if (!alreadyPrimary) {
        const existing = user.emailAddresses.find(
          (entry) => entry.emailAddress.trim().toLowerCase() === targetEmail,
        );

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

        // Supprimer les anciennes adresses (notamment une adresse erronée).
        for (const entry of user.emailAddresses) {
          if (entry.emailAddress.trim().toLowerCase() === targetEmail) continue;
          try {
            await client.emailAddresses.deleteEmailAddress(entry.id);
          } catch (error) {
            console.error("Unable to delete previous Clerk email address", error);
          }
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
      await client.users.updateUser(user.id, {
        firstName: nextFirstName,
        lastName: nextLastName,
      });
    }

    return { ok: true };
  } catch (error) {
    console.error("Clerk contact sync failed", error);
    return {
      ok: false,
      warning:
        "Les coordonnées du site sont enregistrées, mais l'adresse de connexion Clerk n'a pas pu être mise à jour. Vérifiez le compte dans Clerk.",
    };
  }
}
