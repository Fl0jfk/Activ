import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { NOINDEX_METADATA } from "@/lib/seo";

export const metadata: Metadata = { title: "Connexion", ...NOINDEX_METADATA };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; email?: string }>;
}) {
  const params = await searchParams;
  const accountCreated = params.created === "1";
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-md text-center">
        <span className="eyebrow">Espace adhérents</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Connexion</h1>
        <p className="mt-2 text-slate-600">
          Retrouvez votre dossier, vos séances et les informations de l&apos;association.
        </p>
      </div>
      {accountCreated ? (
        <div className="mx-auto mt-6 w-full max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Compte créé avec succès. Connectez-vous maintenant
          {params.email ? ` avec ${params.email}.` : "."}
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
    </main>
  );
}
