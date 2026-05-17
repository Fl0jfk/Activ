import { notFound } from "next/navigation";
import TrialBookingForm from "@/components/trial-booking-form";
import { readClubData } from "@/lib/club-data";
import { readSiteData } from "@/lib/site-data";
import { listUpcomingTrialSlots } from "@/lib/trial-slots";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function DisciplineTrialPage({ params }: PageProps) {
  const { slug } = await params;
  const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);
  const discipline = siteData.disciplines.find((item) => item.slug === slug && item.active);

  if (!discipline || !discipline.allowTrialRequest) {
    notFound();
  }

  const slots = listUpcomingTrialSlots(clubData, { disciplineId: discipline.id });

  return (
    <TrialBookingForm
      disciplineId={discipline.id}
      disciplineName={discipline.name}
      disciplineSlug={discipline.slug}
      slots={slots}
    />
  );
}
