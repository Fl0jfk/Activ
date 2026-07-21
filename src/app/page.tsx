import Image from "next/image";
import Link from "next/link";
import { readSiteData } from "@/lib/site-data";
import {
  buildWeekSchedule,
  formatDayLabelFr,
  formatWeekRangeLabel,
  getPublicScheduleReference,
} from "@/lib/schedule-week";
import {
  formatEventSchedule,
  newsKindLabel,
  resolveNewsDisciplineLabel,
  sortNewsByDateDesc,
} from "@/lib/site-news";
import ActivityOrientation from "@/components/activity-orientation";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preregistration?: string }>;
}) {
  const params = await searchParams;
  const preregistrationReceived = params.preregistration === "received";
  const data = await readSiteData();
  const activeDisciplines = data.disciplines.filter((discipline) => discipline.active);
  const { referenceDate, isSummerBreak, resumeIso } = getPublicScheduleReference();
  const weekSchedule = buildWeekSchedule(data, referenceDate);
  const weekLabel = formatWeekRangeLabel(referenceDate);
  const latestNews = sortNewsByDateDesc(data.news).slice(0, 4);

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-8 pt-12">
        {preregistrationReceived ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Nous avons bien reçu votre demande de pré-inscription. Vous recevrez un email dans quelques jours, une
            fois votre demande validée par le bureau de l&apos;association. Ensuite, vous pourrez accéder à votre espace.
          </div>
        ) : null}
        <header className="rounded-3xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-fuchsia-500 p-6 shadow-xl sm:p-10">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-white/90">{data.association.city}</p>
            <h1 className="text-3xl font-bold text-white sm:text-5xl">{data.association.name}</h1>
            <p className="text-lg text-white/95">{data.association.tagline}</p>
            <p className="text-sm text-white/90">
              Rejoins une association locale qui fait bouger Sainte-Croix. Cours sportifs et culturels, ambiance
              bienveillante, progression adaptée à chacun.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={data.association.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                Voir la page Facebook
              </a>
              <Link
                href="/preinscription"
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-400"
              >
                Faire une pré-inscription
              </Link>
              <span className="rounded-full border border-white/40 bg-white/15 px-3 py-2 text-xs font-semibold text-white">
                Activer, bouger, renforcer, partager
              </span>
            </div>
          </div>
        </header>

        {latestNews.length > 0 ? (
          <section id="actualites" className="anchor-section panel mt-8 p-6 sm:p-8">
            <h2 className="panel-title">Actualités de l&apos;association</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {latestNews.map((item) => {
                const discipline = item.disciplineId
                  ? data.disciplines.find((entry) => entry.id === item.disciplineId)
                  : null;
                const cardClassName =
                  "block rounded-2xl border border-orange-200 bg-gradient-to-br from-amber-50 to-orange-100 p-4 transition hover:-translate-y-0.5 hover:shadow-md";
                const cardContent = (
                  <>
                    <p className="text-xs font-semibold uppercase text-orange-700">
                      {newsKindLabel(item.kind)} · {resolveNewsDisciplineLabel(item.disciplineId, data.disciplines)}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-700">{formatEventSchedule(item)}</p>
                    {item.location ? (
                      <p className="mt-1 text-sm text-slate-600">Lieu : {item.location}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-2 text-sm text-slate-700">{item.description}</p>
                    ) : null}
                  </>
                );

                return discipline ? (
                  <Link key={item.id} href={`/disciplines/${discipline.slug}`} className={cardClassName}>
                    {cardContent}
                  </Link>
                ) : (
                  <article key={item.id} className={cardClassName}>
                    {cardContent}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section id="programme" className="anchor-section panel mt-8 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="panel-title">
                {isSummerBreak ? "Planning de rentrée" : "Planning de la semaine"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
            </div>
            <span className="gradient-chip">
              {isSummerBreak ? "Reprise le 7 septembre" : "Mise à jour dynamique"}
            </span>
          </div>
          {isSummerBreak ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Fermeture estivale : l&apos;association ne propose pas de cours jusqu&apos;au{" "}
              <strong>{formatDayLabelFr(resumeIso)}</strong>. Voici les horaires de la semaine de
              reprise.
            </p>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700">
                  <th className="py-2 pr-4">Jour</th>
                  <th className="py-2 pr-4">Horaire</th>
                  <th className="py-2 pr-4">Discipline</th>
                  <th className="py-2 pr-4">Lieu</th>
                  <th className="py-2 pr-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {weekSchedule.length > 0 ? (
                  weekSchedule.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-slate-100 transition ${
                        entry.cancelled ? "bg-rose-50/80" : "hover:bg-cyan-50/50"
                      }`}
                    >
                      <td
                        className={`py-3 pr-4 font-medium ${
                          entry.cancelled ? "text-rose-800 line-through" : "text-slate-900"
                        }`}
                      >
                        {entry.dayLabel}
                      </td>
                      <td className={`py-3 pr-4 ${entry.cancelled ? "text-rose-700 line-through" : "text-slate-700"}`}>
                        {entry.startTime} - {entry.endTime}
                      </td>
                      <td className={`py-3 pr-4 ${entry.cancelled ? "text-rose-700 line-through" : "text-slate-700"}`}>
                        {entry.disciplineName}
                        {entry.teacherName ? (
                          <span className="mt-0.5 block text-xs text-slate-500">{entry.teacherName}</span>
                        ) : null}
                      </td>
                      <td className={`py-3 pr-4 ${entry.cancelled ? "text-rose-700 line-through" : "text-slate-700"}`}>
                        {entry.location}
                      </td>
                      <td className="py-3 pr-4">
                        {entry.cancelled ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white">
                              Annulé
                            </span>
                            {entry.cancelReason ? (
                              <span className="max-w-[12rem] text-xs text-rose-700">{entry.cancelReason}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                            Confirmé
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-slate-600">
                      Aucun cours programmé cette semaine. Ajoutez des horaires depuis l&apos;admin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <ActivityOrientation />

        <section id="disciplines" className="anchor-section panel mt-8 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="panel-title">Disciplines disponibles</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {activeDisciplines.length} activités
            </span>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeDisciplines.map((discipline) => (
              <Link
                key={discipline.id}
                href={`/disciplines/${discipline.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/35 to-fuchsia-50/50 p-4 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-fuchsia-200/55 blur-xl" />
                <Image
                  src={discipline.imageUrl}
                  alt={discipline.name}
                  width={700}
                  height={380}
                  className="h-44 w-full rounded-xl object-cover"
                />
                <h3 className="mt-4 text-xl font-semibold text-slate-900 group-hover:text-cyan-700">{discipline.name}</h3>
                <p className="mt-2 text-slate-700">{discipline.description}</p>
                <span className="mt-3 inline-block rounded-lg bg-cyan-700 px-3 py-1 text-xs font-semibold text-white">
                  Je me pré-inscris
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <footer className="mt-2 w-full border-t border-white/30 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-8 text-sm sm:px-8">
          <p className="text-md text-slate-300">© 2026 Sainte-Croix-sur-Buchy</p>
        </div>
      </footer>
    </>
  );
}
