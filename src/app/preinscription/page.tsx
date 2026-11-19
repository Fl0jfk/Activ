import type { Metadata } from "next";
import MembershipBulletinForm from "@/components/membership-bulletin-form";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { buildMembershipActivityCatalog } from "@/lib/membership-activities";
import { buildPageMetadata, SITE_LOCALITY } from "@/lib/seo";
import { readPublicSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Pré-inscription en ligne",
  description: `Inscrivez-vous en ligne à Activ' Sainte-Croix, association sportive et culturelle de ${SITE_LOCALITY} : bulletin d'adhésion et choix des activités.`,
  path: "/preinscription",
});

type PageProps = {
  searchParams: Promise<{ discipline?: string; revalidateToken?: string }>;
};

export default async function PreinscriptionPage({ searchParams }: PageProps) {
  const { discipline: disciplineParam, revalidateToken } = await searchParams;
  const siteData = await readPublicSiteData();
  const disciplines = getActiveDisciplineOptions(siteData);
  const activityOptions = buildMembershipActivityCatalog(siteData);

  const matchedDiscipline = disciplineParam
    ? disciplines.find((d) => d.slug === disciplineParam || d.id === disciplineParam)
    : undefined;

  return (
    <MembershipBulletinForm
      activityOptions={activityOptions}
      initialDisciplineId={matchedDiscipline?.id}
      revalidateToken={revalidateToken}
    />
  );
}
