import Link from "next/link";
import type { RoleResolution } from "@/lib/clerk-role";

type EspaceAccessBlockedProps = {
  roleResolution: RoleResolution;
};

export default function EspaceAccessBlocked({ roleResolution }: EspaceAccessBlockedProps) {
  const isMember = roleResolution.role === "member";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-2xl font-bold text-amber-900">Espace membre en attente</h1>
        <p className="mt-2 text-amber-800">
          Votre compte a bien été créé. L&apos;accès à votre espace personnel sera activé après validation de
          votre demande par le bureau de l&apos;association.
        </p>
        <p className="mt-2 text-sm text-amber-800">
          Vous pourrez vous connecter dès que l&apos;étape « Valider l&apos;espace » sera effectuée sur votre
          dossier.
        </p>

        {!isMember ? (
          <div className="mt-6 rounded-xl border border-amber-300 bg-white p-4 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">Diagnostic (pour débloquer un compte bureau)</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Rôle lu par l&apos;application : <strong>{roleResolution.role}</strong> (source :{" "}
                {roleResolution.source})
              </li>
              <li>
                Metadata privée <code className="rounded bg-slate-100 px-1">role</code> :{" "}
                <strong>{formatRaw(roleResolution.privateRoleRaw)}</strong>
              </li>
              <li>
                Metadata publique <code className="rounded bg-slate-100 px-1">role</code> :{" "}
                <strong>{formatRaw(roleResolution.publicRoleRaw)}</strong>
              </li>
              <li>
                Metadata publique <code className="rounded bg-slate-100 px-1">functions</code> :{" "}
                <strong>{formatRaw(roleResolution.publicFunctionsRaw)}</strong>
              </li>
            </ul>
            <p className="mt-3 text-slate-700">
              Pour un accès <strong>direction</strong>, mettez exactement{" "}
              <code className="rounded bg-slate-100 px-1">{`"role": "direction"`}</code> dans les metadata{" "}
              <strong>privées</strong> Clerk (Dashboard → Utilisateurs → votre compte → Private metadata), puis
              déconnectez-vous et reconnectez-vous.
            </p>
            <p className="mt-2">
              <Link href="/api/me/access" className="font-semibold text-cyan-800 underline">
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
