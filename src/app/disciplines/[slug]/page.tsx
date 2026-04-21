import Image from "next/image";
import { notFound } from "next/navigation";
import { readSiteData } from "@/lib/site-data";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function DisciplinePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await readSiteData();
  const discipline = data.disciplines.find((item) => item.slug === slug && item.active);

  if (!discipline) {
    notFound();
  }

  const disciplineSchedule = data.schedule.filter(
    (slot) => slot.active && slot.disciplineId === discipline.id
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <header className="rounded-3xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 p-6 shadow-xl sm:p-8">
        <Image
          src={discipline.imageUrl}
          alt={discipline.name}
          width={1000}
          height={500}
          className="h-60 w-full rounded-2xl object-cover shadow-2xl"
        />
        <h1 className="mt-6 text-3xl font-bold text-white">{discipline.name}</h1>
        <p className="mt-2 text-white/95">{discipline.description}</p>
      </header>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <article className="panel p-6">
          <h2 className="text-xl font-bold text-slate-900">Coach</h2>
          <div className="mt-3 flex items-center gap-3">
            <Image
              src={discipline.coachPhotoUrl ?? discipline.imageUrl}
              alt={`Photo de ${discipline.teacher}`}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
            />
            <p className="text-slate-800">{discipline.teacher}</p>
          </div>
          <p className="mt-2 text-slate-700">{discipline.coachBio}</p>
        </article>
        <article className="panel p-6">
          <h2 className="text-xl font-bold text-slate-900">Tarif et contact</h2>
          <p className="mt-2 text-slate-700">{discipline.priceInfo}</p>
          <p className="mt-2 text-slate-700">
            Contact:{" "}
            <a href={`mailto:${discipline.contactEmail}`} className="font-semibold text-cyan-700 hover:underline">
              {discipline.contactEmail}
            </a>
          </p>
          {discipline.allowTrialRequest ? (
            <a
              href={`mailto:${discipline.contactEmail}?subject=${encodeURIComponent(`Demande d'essai - ${discipline.name}`)}`}
              className="mt-4 inline-block rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {discipline.ctaText}
            </a>
          ) : null}
        </article>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <article className="panel p-6">
          <h2 className="text-xl font-bold text-slate-900">Materiel a apporter</h2>
          <ul className="mt-3 space-y-2 text-slate-700">
            {discipline.whatToBring.length > 0 ? (
              discipline.whatToBring.map((item) => <li key={item}>• {item}</li>)
            ) : (
              <li>Aucun materiel particulier requis.</li>
            )}
          </ul>
        </article>
        <article className="panel p-6">
          <h2 className="text-xl font-bold text-slate-900">Materiel fourni</h2>
          <ul className="mt-3 space-y-2 text-slate-700">
            {discipline.providedItems.length > 0 ? (
              discipline.providedItems.map((item) => <li key={item}>• {item}</li>)
            ) : (
              <li>Informations a venir.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="panel mt-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">Horaires de cette discipline</h2>
          <span className="gradient-chip">Toujours a jour</span>
        </div>
        <div className="mt-3 space-y-3">
          {disciplineSchedule.length > 0 ? (
            disciplineSchedule.map((slot) => (
              <div key={slot.id} className="rounded-xl border border-cyan-100 bg-cyan-50/50 px-4 py-3 text-slate-700">
                <span className="font-semibold text-slate-900">{slot.day}</span> - {slot.startTime} / {slot.endTime} ({slot.location})
              </div>
            ))
          ) : (
            <p className="text-slate-700">Aucun horaire disponible pour le moment.</p>
          )}
        </div>
      </section>

      {discipline.events.length > 0 ? (
        <section className="panel mt-6 p-6">
          <h2 className="text-xl font-bold text-slate-900">Evenements de la discipline</h2>
          <div className="mt-4 space-y-3">
            {discipline.events.map((event) => (
              <article key={event.id} className="rounded-xl border border-orange-200 bg-orange-50/65 p-4">
                <p className="text-sm font-semibold text-cyan-700">{event.date}</p>
                <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                <p className="mt-1 text-slate-700">{event.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
