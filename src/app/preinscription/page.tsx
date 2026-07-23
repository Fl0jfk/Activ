import MembershipBulletinForm from "@/components/membership-bulletin-form";
import { getActiveDisciplineOptions } from "@/lib/discipline-options";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ discipline?: string }>;
};

export default async function PreinscriptionPage({ searchParams }: PageProps) {
  const { discipline: disciplineParam } = await searchParams;
  const siteData = await readSiteData();
  const disciplines = getActiveDisciplineOptions(siteData);

  const matchedDiscipline = disciplineParam
    ? disciplines.find((d) => d.slug === disciplineParam || d.id === disciplineParam)
    : undefined;

  return (
    <MembershipBulletinForm
      disciplines={disciplines}
      initialDisciplineId={matchedDiscipline?.id}
    />
  );
}
