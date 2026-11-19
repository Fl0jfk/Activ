import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import type { RoleResolution } from "@/lib/clerk-role";

type EspaceAccessBlockedProps = {
  roleResolution: RoleResolution;
};

export default function EspaceAccessBlocked({ roleResolution }: EspaceAccessBlockedProps) {
  const isMember = roleResolution.role === "member";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="panel p-6 sm:p-8">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange text-2xl font-bold text-white"
        >
          ⏳
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Votre inscription est en cours de validation
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-700">
          Votre demande a bien été reçue et votre compte est créé. Le bureau de l’association est en train d’étudier votre
          dossier.
        </p>

        <h2 className="mt-6 text-lg font-extrabold text-slate-900">Et maintenant ?</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-[15px] leading-6 text-slate-700">
          <li>Le bureau vérifie votre dossier. Cela peut prendre quelques jours.</li>
          <li>
            Vous recevez un <strong>e-mail</strong> dès que votre espace adhérent est activé.
          </li>
          <li>Vous pouvez alors vous connecter ici avec votre e-mail et votre mot de passe.</li>
        </ol>
        <p className="mt-4 text-[15px] leading-6 text-slate-700">
          Une question ? Appelez le bureau au{" "}
          <a href={ASSOCIATION_PHONE_TEL} className="font-bold text-brand-blue underline underline-offset-2">
            {ASSOCIATION_PHONE_DISPLAY}
          </a>
          .
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn btn-primary">
            Retour à l’accueil
          </Link>
          <SignOutButton />
        </div>

        {!isMember ? (
          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-800">
            <p className="font-bold text-slate-900">Diagnostic (compte bureau ou coach)</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Rôle lu par l’application : <strong>{roleResolution.role}</strong> (source : {roleResolution.source})
              </li>
              <li>
                Metadata privée <code className="rounded bg-white px-1">role</code> :{" "}
                <strong>{formatRaw(roleResolution.privateRoleRaw)}</strong>
              </li>
              <li>
                Metadata publique <code className="rounded bg-white px-1">role</code> :{" "}
                <strong>{formatRaw(roleResolution.publicRoleRaw)}</strong>
              </li>
              <li>
                Metadata publique <code className="rounded bg-white px-1">functions</code> :{" "}
                <strong>{formatRaw(roleResolution.publicFunctionsRaw)}</strong>
              </li>
            </ul>
            <p className="mt-3 text-slate-700">
              Pour un accès <strong>président</strong>, mettez exactement{" "}
              <code className="rounded bg-white px-1">{`"role": "president"`}</code> dans les metadata{" "}
              <strong>privées</strong> Clerk (Dashboard → Utilisateurs → votre compte → Private metadata), puis
              déconnectez-vous et reconnectez-vous. Autres rôles bureau :{" "}
              <code className="rounded bg-white px-1">vice_president</code>,{" "}
              <code className="rounded bg-white px-1">treasurer</code>,{" "}
              <code className="rounded bg-white px-1">secretary</code>.
            </p>
            <p className="mt-2">
              <Link href="/api/me/access" className="font-bold text-brand-blue underline">
                Voir le détail JSON de votre session
              </Link>
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function formatRaw(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "(absent)";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return JSON.stringify(value);
}
