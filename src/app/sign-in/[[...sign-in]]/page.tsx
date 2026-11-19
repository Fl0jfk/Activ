import type { Metadata } from "next";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import { NOINDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = { title: "Connexion", ...NOINDEX_METADATA };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; email?: string; forgot?: string }>;
}) {
  const params = await searchParams;
  const accountCreated = params.created === "1";
  const forgotPassword = params.forgot === "1";
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-md text-center">
        <span className="eyebrow">Espace adhérents</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Connexion</h1>
        <p className="mt-2 text-[15px] leading-6 text-slate-600">
          Retrouvez votre dossier, vos séances et les informations de l&apos;association.
        </p>
      </div>
      {accountCreated ? (
        <div
          role="status"
          className="mx-auto mt-6 w-full max-w-md rounded-2xl bg-brand-blue/10 px-4 py-3 text-[15px] leading-6 text-brand-blue-dark ring-1 ring-brand-blue/20"
        >
          <p className="font-bold">Connectez-vous avec l’e-mail et le mot de passe choisis lors de votre inscription.</p>
          {params.email ? <p className="mt-1">Adresse utilisée : {params.email}</p> : null}
          <p className="mt-1 text-slate-700">
            Votre espace sera ouvert dès que le bureau aura validé votre dossier : vous en serez prévenu(e) par e-mail.
          </p>
        </div>
      ) : null}
      {forgotPassword ? (
        <div
          role="status"
          className="mx-auto mt-6 w-full max-w-md rounded-2xl bg-brand-blue/10 px-4 py-3 text-[15px] leading-6 text-brand-blue-dark ring-1 ring-brand-blue/20"
        >
          <p className="font-bold">Mot de passe oublié ?</p>
          <p className="mt-1 text-slate-700">
            Saisissez votre adresse e-mail, puis cliquez sur « Mot de passe oublié ? » sous le champ du mot de passe pour
            recevoir un lien de réinitialisation.
          </p>
        </div>
      ) : null}
      <div className="mx-auto mt-8 flex w-full justify-center">
        <SignIn
          path="/sign-in"
          signUpUrl="/preinscription"
          forceRedirectUrl="/espace"
          fallbackRedirectUrl="/espace"
        />
      </div>
      <div className="mx-auto mt-8 max-w-md space-y-3 text-center text-[15px] text-slate-700">
        <p className="font-bold text-slate-900">Pas encore inscrit(e) ?</p>
        <Link href="/preinscription" className="btn btn-outline w-full sm:w-auto">
          Faire une pré-inscription
        </Link>
        <p>
          Besoin d’aide ? Appelez le bureau au{" "}
          <a href={ASSOCIATION_PHONE_TEL} className="font-bold text-brand-blue underline underline-offset-2">
            {ASSOCIATION_PHONE_DISPLAY}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
