import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSiteData } from "@/lib/site-data";
import {
  buildDisciplineWeekSchedule,
  formatDayLabelFr,
  formatWeekRangeLabel,
  getPublicScheduleReference,
} from "@/lib/schedule-week";
import { formatEventSchedule, newsKindLabel, truncateNewsDescription } from "@/lib/site-news";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ essai?: string }>;
};

export const dynamic = "force-dynamic";

export default async function DisciplinePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { essai } = await searchParams;
  const trialReserved = essai === "reserve";
  const data = await readSiteData();
  const discipline = data.disciplines.find((item) => item.slug === slug && item.active);
  if (!discipline) {
    notFound();
  }
  const teacherList =
    discipline.teachers.length > 0 ? discipline.teachers : [discipline.teacher || "Coach a definir"];
  const { referenceDate, isSummerBreak, resumeIso } = getPublicScheduleReference();
  const weekSchedule = buildDisciplineWeekSchedule(data, discipline.id, referenceDate);
  const weekLabel = formatWeekRangeLabel(referenceDate);
  const disciplineNews = data.news
    .filter((item) => item.disciplineId === discipline.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      {trialReserved ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Votre réservation d&apos;essai a bien été enregistrée. Le bureau validera votre espace membre sous peu.
        </div>
      ) : null}
      <header className="rounded-3xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 p-6 shadow-xl sm:p-8">
        <Image
          src={discipline.imageUrl}
          alt={discipline.name}
          width={1000}
          height={500}
          unoptimized={discipline.imageUrl.startsWith("/api/")}
          className="h-60 w-full rounded-2xl object-cover shadow-2xl"
        />
        <h1 className="mt-6 text-3xl font-bold text-white">{discipline.name}</h1>
        <p className="mt-2 text-white/95">{discipline.description}</p>
      </header>
      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <article className="panel p-6">
          <h2 className="text-xl font-bold text-slate-900">Enseignants</h2>
          <div className="mt-3 flex items-center gap-3">
            <Image
              src={discipline.coachPhotoUrl ?? discipline.imageUrl}
              alt={`Photo de ${teacherList[0]}`}
              width={56}
              height={56}
              unoptimized={(discipline.coachPhotoUrl ?? discipline.imageUrl).startsWith("/api/")}
              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
            />
            <div>
              {teacherList.map((teacher) => (
                <p key={teacher} className="text-slate-800">
                  {teacher}
                </p>
              ))}
            </div>
          </div>
          <p className="mt-2 text-slate-700">{discipline.coachBio}</p>
        </article>
        <article className="panel p-6">
          <h2 className="text-xl font-bold text-slate-900">Tarif et contact</h2>
          <p className="mt-2 text-slate-700">{discipline.priceInfo}</p>
          {discipline.annualFee ? (
            <p className="mt-2 text-slate-700">
              <span className="font-semibold">Licence a l&apos;annee:</span> {discipline.annualFee}
            </p>
          ) : null}
          {/* Contact masqué tant que les adresses ne sont pas validées */}
          <p className="mt-2 hidden text-slate-700" aria-hidden>
            Contact discipline:{" "}
            <a href={`mailto:${discipline.contactEmail}`} className="font-semibold text-cyan-700 hover:underline" tabIndex={-1}>
              {discipline.contactEmail}
            </a>
          </p>
          {discipline.allowTrialRequest ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/disciplines/${discipline.slug}/essai`}
                className="inline-block rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {discipline.ctaText}
              </Link>
              <Link
                href={`/preinscription?discipline=${discipline.slug}`}
                className="inline-block rounded-xl border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50"
              >
                Pré-inscription complète
              </Link>
            </div>
          ) : (
            <Link
              href={`/preinscription?discipline=${discipline.slug}`}
              className="mt-4 inline-block rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Je me pré-inscris
            </Link>
          )}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isSummerBreak ? "Horaires de rentrée" : "Horaires cette semaine"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
          </div>
          <span className="gradient-chip">
            {isSummerBreak ? "Reprise le 7 septembre" : "Toujours a jour"}
          </span>
        </div>
        {isSummerBreak ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Fermeture estivale jusqu&apos;au {formatDayLabelFr(resumeIso)}. Voici les horaires de la
            semaine de reprise.
          </p>
        ) : null}
        <div className="mt-3 space-y-3">
          {weekSchedule.length > 0 ? (
            weekSchedule.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-xl border px-4 py-3 ${
                  entry.cancelled
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-cyan-100 bg-cyan-50/50 text-slate-700"
                }`}
              >
                <span className={`font-semibold ${entry.cancelled ? "line-through" : "text-slate-900"}`}>
                  {entry.dayLabel}
                </span>{" "}
                - {entry.startTime} / {entry.endTime} ({entry.location})
                {entry.teacherName ? <span className="ml-2 text-sm">- {entry.teacherName}</span> : null}
                {entry.cancelled ? (
                  <p className="mt-1 text-sm font-semibold text-rose-700">
                    Annule{entry.cancelReason ? ` : ${entry.cancelReason}` : ""}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-slate-700">Aucun horaire disponible pour le moment.</p>
          )}
        </div>
      </section>

      {disciplineNews.length > 0 ? (
        <section className="panel mt-6 p-6">
          <h2 className="text-xl font-bold text-slate-900">Actualités de la discipline</h2>
          <div className="mt-4 space-y-3">
            {disciplineNews.map((event) => (
              <Link
                key={event.id}
                href={`/actualites/${event.id}`}
                className="block rounded-xl border border-orange-200 bg-orange-50/65 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {event.imageUrl ? (
                  <Image
                    src={event.imageUrl}
                    alt=""
                    width={800}
                    height={360}
                    unoptimized={event.imageUrl.startsWith("/api/")}
                    className="mb-3 h-40 w-full rounded-xl object-cover"
                  />
                ) : null}
                <p className="text-xs font-semibold uppercase text-orange-700">
                  {newsKindLabel(event.kind)}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{event.title}</h3>
                <p className="mt-1 text-sm text-cyan-800">{formatEventSchedule(event)}</p>
                {event.location ? (
                  <p className="mt-1 text-sm text-slate-600">Lieu : {event.location}</p>
                ) : null}
                {event.description ? (
                  <p className="mt-2 text-slate-700">{truncateNewsDescription(event.description)}</p>
                ) : null}
                <span className="mt-3 inline-block text-sm font-semibold text-orange-800">
                  Lire la suite →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
