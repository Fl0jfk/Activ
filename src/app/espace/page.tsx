import { redirect } from "next/navigation";
import EspaceHub from "@/components/espace-hub";
import { canAccessAdminSpace, getCurrentUserContext } from "@/lib/clerk";
import { readClubData } from "@/lib/club-data";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export default async function EspacePage() {
  const currentUser = await getCurrentUserContext();
  if (!currentUser) {
    redirect("/sign-in?redirect_url=/espace");
  }

  const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);
  const disciplines = siteData.disciplines.filter((discipline) => discipline.active).map((discipline) => ({
    id: discipline.id,
    name: discipline.name,
  }));
  const canAccessAdmin = canAccessAdminSpace(currentUser.publicFunctions);
  if (!canAccessAdmin && currentUser.membershipStatus !== "approved") {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-bold text-amber-900">Pre-inscription en attente de validation</h1>
          <p className="mt-2 text-amber-800">
            Ton compte est cree, mais l&apos;acces a l&apos;espace membre sera actif apres validation par le president ou la secretaire.
          </p>
        </section>
      </main>
    );
  }

  return (
    <EspaceHub
      canAccessAdmin={canAccessAdmin}
      disciplines={disciplines}
      slots={clubData.trialSlots.filter((slot) => slot.active)}
      myApplications={clubData.applications.filter((application) => application.clerkUserId === currentUser.userId)}
      allApplications={clubData.applications}
    />
  );
}
