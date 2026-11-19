import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CallButton from "@/components/call-button";
import NewsCard from "@/components/news-card";
import OrientationAssistant from "@/components/orientation-assistant";
import SiteImage from "@/components/site-image";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import { buildDisciplineColors } from "@/lib/discipline-colors";
import { describeDisciplineSessions, formatHourLabel } from "@/lib/public-site";
import { buildPageMetadata, SITE_LOCALITY, toMetaDescription } from "@/lib/seo";
import { readPublicSiteData } from "@/lib/site-data";
import {
  buildDisciplineWeekSchedule,
  formatDayLabelFr,
  formatWeekRangeLabel,
  getPublicScheduleReference,
} from "@/lib/schedule-week";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ essai?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const data = await readPublicSiteData();
  const discipline = data.disciplines.find((item) => item.slug === slug && item.active);
  if (!discipline) return { title: "Discipline introuvable", robots: { index: false } };
  const teachers = discipline.teachers.length > 0 ? discipline.teachers : [discipline.teacher].filter(Boolean);
  const fallback = `Cours de ${discipline.name} à ${SITE_LOCALITY}${
    teachers.length > 0 ? ` avec ${teachers.join(" et ")}` : ""
  }. Horaires, tarifs et pré-inscription.`;
  return buildPageMetadata({
    title: `${discipline.name} à ${SITE_LOCALITY}`,
    description: toMetaDescription(discipline.description || fallback),
    path: `/disciplines/${discipline.slug}`,
    image: discipline.imageUrl,
    imageAlt: discipline.name,
  });
}

export default async function DisciplinePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { essai } = await searchParams;
  const trialReserved = essai === "reserve";
  const data = await readPublicSiteData();
  const discipline = data.disciplines.find((item) => item.slug === slug && item.active);
  if (!discipline) {
    notFound();
  }
  const teacherList =
    discipline.teachers.length > 0 ? discipline.teachers : [discipline.teacher || "Coach à définir"];
  const { referenceDate, isSummerBreak, resumeIso } = getPublicScheduleReference();
  const weekSchedule = buildDisciplineWeekSchedule(data, discipline.id, referenceDate);
  const weekLabel = formatWeekRangeLabel(referenceDate);
  const disciplineNews = data.news
    .filter((item) => item.disciplineId === discipline.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const color = buildDisciplineColors(data.disciplines)[discipline.id];
  const sessions = describeDisciplineSessions(discipline.id, data.schedule);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      {trialReserved ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Votre réservation d&apos;essai a bien été enregistrée. Le bureau validera votre espace membre sous peu.
        </div>
      ) : null}

      <Link href="/#disciplines" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Toutes les disciplines
      </Link>

      <header className="mt-4 grid items-center gap-8 md:grid-cols-2">
        <div>
          <span className="eyebrow">Discipline</span>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {discipline.name}
          </h1>
          {sessions ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-brand-line">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color?.bg }} aria-hidden />
              {sessions}
            </p>
          ) : null}
          <p className="mt-4 text-lg text-slate-600">{discipline.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {discipline.allowTrialRequest ? (
              <>
                <Link href={`/disciplines/${discipline.slug}/essai`} className="btn btn-primary">
                  {discipline.ctaText}
                </Link>
                <Link href={`/preinscription?discipline=${discipline.slug}`} className="btn btn-outline">
                  Pré-inscription complète
                </Link>
              </>
            ) : (
              <Link href={`/preinscription?discipline=${discipline.slug}`} className="btn btn-primary">
                Je me pré-inscris
              </Link>
            )}
            <CallButton />
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <SiteImage
            src={discipline.imageUrl}
            alt={discipline.name}
            width={1000}
            height={700}
            priority
            sizes="(min-width: 768px) 480px, 100vw"
            style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: 420 }}
            className="rounded-3xl shadow-[0_30px_60px_-30px_rgba(20,64,127,0.45)]"
          />
        </div>
      </header>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="panel p-6">
          <h2 className="text-xl font-extrabold text-slate-900">
            {teacherList.length > 1 ? "Enseignants" : "Enseignant(e)"}
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <SiteImage
              src={discipline.coachPhotoUrl ?? discipline.imageUrl}
              alt={`Photo de ${teacherList[0]}`}
              width={56}
              height={56}
              className="h-14 w-14 rounded-full border border-brand-line object-cover"
            />
            <div>
              {teacherList.map((teacher) => (
                <p key={teacher} className="font-semibold text-slate-800">
                  {teacher}
                </p>
              ))}
            </div>
          </div>
          {discipline.coachBio ? <p className="mt-3 text-slate-700">{discipline.coachBio}</p> : null}
        </article>
        <article className="panel p-6">
          <h2 className="text-xl font-extrabold text-slate-900">Tarif et contact</h2>
          <p className="mt-3 text-slate-700">{discipline.priceInfo}</p>
          {discipline.annualFee ? (
            <p className="mt-2 text-slate-700">
              <span className="font-semibold">Licence à l&apos;année :</span> {discipline.annualFee}
            </p>
          ) : null}
          {/* Contact masqué tant que les adresses ne sont pas validées */}
          <p className="mt-2 hidden text-slate-700" aria-hidden>
            Contact discipline :{" "}
            <a href={`mailto:${discipline.contactEmail}`} className="font-semibold text-brand-blue hover:underline" tabIndex={-1}>
              {discipline.contactEmail}
            </a>
          </p>
          <p className="mt-4 text-sm text-slate-600">
            Une question ? Appelez-nous au{" "}
            <a href={ASSOCIATION_PHONE_TEL} className="font-bold text-brand-blue hover:underline">
              {ASSOCIATION_PHONE_DISPLAY}
            </a>
            .
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-2">
        <article className="panel p-6">
          <h2 className="text-xl font-extrabold text-slate-900">Matériel à apporter</h2>
          <ul className="mt-3 space-y-2 text-slate-700">
            {discipline.whatToBring.length > 0 ? (
              discipline.whatToBring.map((item) => <li key={item}>• {item}</li>)
            ) : (
              <li>Aucun matériel particulier requis.</li>
            )}
          </ul>
        </article>
        <article className="panel p-6">
          <h2 className="text-xl font-extrabold text-slate-900">Matériel fourni</h2>
          <ul className="mt-3 space-y-2 text-slate-700">
            {discipline.providedItems.length > 0 ? (
              discipline.providedItems.map((item) => <li key={item}>• {item}</li>)
            ) : (
              <li>Informations à venir.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="panel mt-6 p-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {isSummerBreak ? "Horaires de rentrée" : "Horaires cette semaine"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{weekLabel}</p>
        </div>
        {isSummerBreak ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Fermeture estivale jusqu&apos;au {formatDayLabelFr(resumeIso)}. Voici les horaires de la semaine de reprise.
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          {weekSchedule.length > 0 ? (
            weekSchedule.map((entry) => (
              <div
                key={entry.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border px-4 py-3 ${
                  entry.cancelled
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-brand-line bg-brand-cream text-slate-700"
                }`}
              >
                <span className={`font-extrabold ${entry.cancelled ? "line-through" : "text-slate-900"}`}>
                  {entry.dayLabel}
                </span>
                <span className="tabular-nums">
                  {entry.startTime && entry.endTime
                    ? `${formatHourLabel(entry.startTime)} – ${formatHourLabel(entry.endTime)}`
                    : entry.startTime
                      ? formatHourLabel(entry.startTime)
                      : "Horaire à préciser"}
                </span>
                {entry.location ? <span className="text-sm">· {entry.location}</span> : null}
                {entry.teacherName ? <span className="text-sm">· {entry.teacherName}</span> : null}
                {entry.cancelled ? (
                  <span className="w-full text-sm font-bold text-rose-700">
                    Annulé{entry.cancelReason ? ` : ${entry.cancelReason}` : ""}
                  </span>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-slate-700">Aucun horaire disponible pour le moment.</p>
          )}
        </div>
      </section>

      <OrientationAssistant
        className="mt-6"
        title={`Une question sur ${discipline.name} ?`}
        subtitle="Niveau, tenue, premier cours… notre assistant vous répond."
        suggestions={[
          {
            label: "Est-ce pour moi ?",
            prompt: `Je suis intéressé(e) par l'activité « ${discipline.name} ». Est-elle adaptée à mon profil si je débute ?`,
          },
          {
            label: "Premier cours",
            prompt: `Comment se passe un premier cours de « ${discipline.name} » et comment l'essayer ?`,
          },
          {
            label: "Autres idées",
            prompt: `J'hésite avec « ${discipline.name} ». Quelles autres activités pourraient me convenir ?`,
          },
        ]}
      />

      {disciplineNews.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl font-extrabold text-slate-900">Actualités de la discipline</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {disciplineNews.map((event) => (
              <NewsCard key={event.id} item={event} disciplines={data.disciplines} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
