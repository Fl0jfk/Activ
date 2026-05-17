import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; email?: string }>;
}) {
  const params = await searchParams;
  const accountCreated = params.created === "1";
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      {accountCreated ? (
        <div className="mx-auto mt-6 w-full max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Compte cree avec succes. Connecte-toi maintenant
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
