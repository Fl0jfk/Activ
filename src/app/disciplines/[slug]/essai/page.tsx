import { notFound } from "next/navigation";
import TrialBookingForm from "@/components/trial-booking-form";
import { readClubData } from "@/lib/club-data";
import { readSiteData } from "@/lib/site-data";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

function countSlotRegistrations(
  applications: { trialSlotId: string | null; status: string }[],
  slotId: string,
): number {
  return applications.filter(
    (entry) => entry.trialSlotId === slotId && entry.status !== "rejected",
  ).length;
}

export default async function DisciplineTrialPage({ params }: PageProps) {
  const { slug } = await params;
  const [siteData, clubData] = await Promise.all([readSiteData(), readClubData()]);
  const discipline = siteData.disciplines.find((item) => item.slug === slug && item.active);

  if (!discipline || !discipline.allowTrialRequest) {
    notFound();
  }

  const now = Date.now();
  const slots = clubData.trialSlots
    .filter(
      (slot) =>
        slot.active &&
        slot.disciplineId === discipline.id &&
        new Date(slot.startsAt).getTime() >= now,
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((slot) => ({
      id: slot.id,
      title: slot.title,
      startsAt: slot.startsAt,
      capacity: slot.capacity,
      registeredCount: countSlotRegistrations(clubData.applications, slot.id),
    }));

  return (
    <TrialBookingForm
      disciplineId={discipline.id}
      disciplineName={discipline.name}
      disciplineSlug={discipline.slug}
      slots={slots}
    />
  );
}
