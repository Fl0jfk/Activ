"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useClerk, useReverification, useSession, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { parseClerkError } from "@/lib/clerk-errors";

type Feedback = { tone: "success" | "error"; text: string } | null;

type AccountSettingsProps = {
  /** Affiche un renvoi vers « Mes coordonnées » quand la section existe. */
  hasContactSection: boolean;
};

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold ${
        feedback.tone === "success" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-800"
      }`}
    >
      {feedback.text}
    </p>
  );
}

export default function AccountSettings({ hasContactSection }: AccountSettingsProps) {
  const { isLoaded, user } = useUser();
  const { session } = useSession();
  const { signOut } = useClerk();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesFeedback, setDevicesFeedback] = useState<Feedback>(null);

  const updatePassword = useReverification(
    (params: { newPassword: string; currentPassword?: string; signOutOfOtherSessions: boolean }) =>
      user!.updatePassword(params),
  );

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  const hasPassword = user?.passwordEnabled ?? true;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setFeedback(null);

    if (newPassword.length < 8) {
      setFeedback({ tone: "error", text: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ tone: "error", text: "Les deux mots de passe ne sont pas identiques." });
      return;
    }

    setBusy(true);
    try {
      await updatePassword({
        newPassword,
        currentPassword: hasPassword ? currentPassword : undefined,
        signOutOfOtherSessions: signOutOthers,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ tone: "success", text: "Votre mot de passe a bien été modifié." });
    } catch (error) {
      if (isReverificationCancelledError(error)) {
        setFeedback({ tone: "error", text: "Vérification annulée : le mot de passe n'a pas été modifié." });
      } else {
        setFeedback({ tone: "error", text: parseClerkError(error).message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function signOutOtherDevices() {
    if (!user) return;
    setDevicesBusy(true);
    setDevicesFeedback(null);
    try {
      const sessions = await user.getSessions();
      const others = sessions.filter((entry) => entry.id !== session?.id);
      await Promise.all(others.map((entry) => entry.revoke()));
      setDevicesFeedback({
        tone: "success",
        text:
          others.length > 0
            ? `${others.length} autre${others.length > 1 ? "s" : ""} appareil${others.length > 1 ? "s" : ""} déconnecté${others.length > 1 ? "s" : ""}.`
            : "Aucun autre appareil n'est connecté.",
      });
    } catch {
      setDevicesFeedback({ tone: "error", text: "Impossible de déconnecter les autres appareils pour le moment." });
    } finally {
      setDevicesBusy(false);
    }
  }

  return (
    <section id="mon-compte" className="anchor-section panel p-6">
      <h2 className="text-xl font-extrabold text-slate-900">Connexion et mot de passe</h2>
      <p className="mt-1 text-sm text-slate-600">Votre identifiant de connexion et votre mot de passe.</p>

      {!isLoaded ? (
        <p className="mt-4 text-sm text-slate-500">Chargement…</p>
      ) : !user ? (
        <p className="mt-4 text-sm text-slate-600">Reconnectez-vous pour gérer votre compte.</p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Identifiant de connexion</h3>
            <dl className="mt-3 space-y-3 rounded-2xl bg-brand-cream/60 p-4 text-sm">
              {fullName ? (
                <div>
                  <dt className="text-slate-500">Nom</dt>
                  <dd className="font-semibold text-slate-900">{fullName}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-slate-500">E-mail de connexion</dt>
                <dd className="text-break font-semibold text-slate-900">{email || "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-slate-600">
              Pour corriger votre nom ou votre e-mail, faites une demande
              {hasContactSection ? (
                <>
                  {" "}
                  dans{" "}
                  <Link href="/espace?tab=member#mes-coordonnees" className="font-bold text-brand-blue hover:underline">
                    Mes coordonnées
                  </Link>
                </>
              ) : null}
              . Le bureau la valide, puis met à jour votre fiche et votre compte.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void signOutOtherDevices()}
                disabled={devicesBusy}
                className="btn btn-ghost btn-sm"
              >
                {devicesBusy ? "Déconnexion…" : "Déconnecter mes autres appareils"}
              </button>
              <button type="button" onClick={() => void signOut({ redirectUrl: "/" })} className="btn btn-ghost btn-sm">
                Se déconnecter
              </button>
            </div>
            <FeedbackMessage feedback={devicesFeedback} />
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
            <h3 className="text-base font-extrabold text-slate-900">
              {hasPassword ? "Changer mon mot de passe" : "Définir un mot de passe"}
            </h3>
            {hasPassword ? (
              <label className="field-label">
                Mot de passe actuel
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  className="field"
                />
              </label>
            ) : null}
            <label className="field-label">
              Nouveau mot de passe
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={busy}
                className="field"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">8 caractères minimum, avec lettres et chiffres.</span>
            </label>
            <label className="field-label">
              Confirmer le nouveau mot de passe
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                disabled={busy}
                className="field"
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={signOutOthers}
                onChange={(event) => setSignOutOthers(event.target.checked)}
                disabled={busy}
                className="mt-0.5"
              />
              Me déconnecter des autres appareils
            </label>
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
              {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
            </button>
            <FeedbackMessage feedback={feedback} />
            <p className="text-xs text-slate-500">
              Mot de passe oublié ? Déconnectez-vous, puis utilisez « Mot de passe oublié » sur la page de connexion.
            </p>
          </form>
        </div>
      )}
    </section>
  );
}
