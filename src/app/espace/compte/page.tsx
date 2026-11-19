import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AccountSettings from "@/components/account-settings";
import { getCurrentUserContext } from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";
import { NOINDEX_METADATA } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mon compte", ...NOINDEX_METADATA };

export default async function ComptePage() {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    redirect("/sign-in?redirect_url=/espace/compte");
  }

  const clubData = await readClubData();
  const hasContactSection = clubData.applications.some(
    (application) =>
      application.clerkUserId === currentUser.userId &&
      application.status !== "rejected" &&
      application.status !== "cancelled",
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <Link href="/espace?tab=member" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Retour à mon espace
      </Link>
      <span className="eyebrow mt-4 block">Mon espace</span>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Mon compte</h1>
      <p className="mb-6 mt-2 text-slate-600">Gérez votre connexion et votre mot de passe.</p>
      <AccountSettings hasContactSection={hasContactSection} />
    </main>
  );
}
