import PublicPreregistrationForm from "@/components/public-preregistration-form";
import { readClubData } from "@/lib/club-data";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export default async function PreinscriptionPage() {
  const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);
  const disciplines = siteData.disciplines.filter((discipline) => discipline.active).map((discipline) => ({
    id: discipline.id,
    name: discipline.name,
  }));
  const slots = clubData.trialSlots.filter((slot) => slot.active).map((slot) => ({
    id: slot.id,
    disciplineId: slot.disciplineId,
    title: slot.title,
    startsAt: slot.startsAt,
  }));

  return <PublicPreregistrationForm disciplines={disciplines} slots={slots} />;
}
