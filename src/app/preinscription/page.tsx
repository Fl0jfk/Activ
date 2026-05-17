import PublicPreregistrationForm from "@/components/public-preregistration-form";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ discipline?: string }>;
};

export default async function PreinscriptionPage({ searchParams }: PageProps) {
  const { discipline: disciplineParam } = await searchParams;
  const siteData = await readSiteData();
  const disciplines = siteData.disciplines
    .filter((discipline) => discipline.active)
    .map((discipline) => ({
      id: discipline.id,
      name: discipline.name,
      slug: discipline.slug,
    }));

  const matchedDiscipline = disciplineParam
    ? disciplines.find((d) => d.slug === disciplineParam || d.id === disciplineParam)
    : undefined;

  return (
    <PublicPreregistrationForm
      disciplines={disciplines}
      initialDisciplineId={matchedDiscipline?.id}
    />
  );
}
