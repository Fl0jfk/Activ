import { frFR } from "@clerk/localizations";

/** Français Clerk + libellés Activ pour le menu utilisateur. */
export const clerkLocalizationFr = {
  ...frFR,
  userButton: {
    ...frFR.userButton,
    action__manageAccount: "Gérer mon compte",
    action__signOut: "Se déconnecter",
  },
  signIn: {
    ...frFR.signIn,
    start: {
      ...frFR.signIn?.start,
      title: "Connexion",
      subtitle: "Accédez à votre espace membre Activ",
    },
  },
};
