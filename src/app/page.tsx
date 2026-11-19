import type { Metadata } from "next";
import Link from "next/link";
import NewsCard from "@/components/news-card";
import OrientationAssistant from "@/components/orientation-assistant";
import PhotoMosaic from "@/components/photo-mosaic";
import PollCard from "@/components/poll-card";
import SiteImage from "@/components/site-image";
import WeekPlanner from "@/components/week-planner";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import { buildDisciplineColors } from "@/lib/discipline-colors";
import { buildPlannerWeeks, describeDisciplineSessions, pickHomeNews } from "@/lib/public-site";
import { formatDayLabelFr, getPublicScheduleReference, todayParisIso } from "@/lib/schedule-week";
import { buildPageMetadata, SITE_LOCALITY, SITE_SHORT_NAME, toMetaDescription } from "@/lib/seo";
import { HOME_PHOTO_COUNT } from "@/lib/public-site-constants";
import { readPublicSiteData } from "@/lib/site-data";
import { limitSentences } from "@/lib/text";

export const dynamic = "force-dynamic";

const HOME_NEWS_COUNT = 3;

export async function generateMetadata(): Promise<Metadata> {
  const data = await readPublicSiteData();
  const names = data.disciplines
    .filter((discipline) => discipline.active)
    .map((discipline) => discipline.name.trim().toLowerCase())
    .filter(Boolean);
  const activities = names.length > 0 ? ` : ${names.join(", ")}` : "";
  return buildPageMetadata({
    title: `${SITE_SHORT_NAME} – Sport et culture à ${SITE_LOCALITY}`,
    description: toMetaDescription(
      `Association sportive et culturelle à ${SITE_LOCALITY}${activities}. Planning des cours, séance d'essai et pré-inscription en ligne.`,
    ),
    path: "/",
    absoluteTitle: true,
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preregistration?: string }>;
}) {
  const params = await searchParams;
  const preregistrationReceived = params.preregistration === "received";
  const data = await readPublicSiteData();
  const activeDisciplines = data.disciplines.filter((discipline) => discipline.active);
  const colors = buildDisciplineColors(data.disciplines);
  const { referenceDate, isSummerBreak, resumeIso } = getPublicScheduleReference();
  const plannerWeeks = buildPlannerWeeks(data, referenceDate);
  const plannerDisciplines = activeDisciplines.map((discipline) => ({
    id: discipline.id,
    name: discipline.name,
    slug: discipline.slug,
    color: colors[discipline.id]!,
  }));

  const homeNews = pickHomeNews(data.news, HOME_NEWS_COUNT);
  const [featuredNews, ...otherNews] = homeNews;
  const openPollNewsIds = new Set(
    data.polls.filter((poll) => poll.status === "open" && poll.newsId).map((poll) => poll.newsId as string),
  );
  const standalonePolls = data.polls.filter((poll) => poll.status === "open" && !poll.newsId);

  const slides = data.homeGallery.slides;
  const heroSlide = slides[0];
  const latestPhotos = slides.slice(-HOME_PHOTO_COUNT).reverse();

  return (
    <main>
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-8 sm:px-8 sm:pt-12">
        {preregistrationReceived ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Nous avons bien reçu votre demande de pré-inscription. Vous recevrez un e-mail dans quelques jours, une
            fois votre demande validée par le bureau de l&apos;association. Vous pourrez ensuite accéder à votre espace.
          </div>
        ) : null}

        <div className={`grid items-center gap-10 ${heroSlide ? "lg:grid-cols-[1.05fr_0.95fr] lg:gap-14" : ""}`}>
          <div>
            <span className="eyebrow">{data.association.city || SITE_LOCALITY}</span>
            <h1 className="mt-3.5 text-[2.1rem] font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              Bouger, se renforcer et <span className="text-brand-blue">partager</span> ensemble.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Une association locale qui fait bouger Sainte-Croix : cours sportifs et culturels, ambiance bienveillante
              et progression adaptée à chacun.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/preinscription" className="btn btn-primary">
                Faire une pré-inscription
              </Link>
              <Link href="/#planning" className="btn btn-outline">
                Voir le planning
              </Link>
            </div>
          </div>

          {heroSlide ? (
            <div className="relative flex justify-center lg:justify-end">
              <span className="absolute -top-4 right-6 h-14 w-14 rounded-full bg-brand-orange/90" aria-hidden />
              <span className="absolute -left-3 bottom-10 h-8 w-8 rounded-full bg-brand-pink" aria-hidden />
              <span className="absolute -left-6 top-1/3 h-5 w-5 rounded-full bg-brand-green" aria-hidden />
              <SiteImage
                src={heroSlide.imageUrl}
                alt={heroSlide.caption || data.association.name}
                width={1200}
                height={800}
                priority
                sizes="(min-width: 1024px) 520px, 100vw"
                style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: 440 }}
                className="relative rounded-3xl shadow-[0_30px_60px_-30px_rgba(20,64,127,0.5)]"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-10 grid gap-3.5 sm:grid-cols-3">
          <div className="rounded-2xl border border-brand-line bg-white px-5 py-3.5 text-sm">
            <p className="font-bold text-slate-900">
              {activeDisciplines.length} activité{activeDisciplines.length > 1 ? "s" : ""}
            </p>
            <p className="text-slate-600">Sport, bien-être et culture</p>
          </div>
          <div className="rounded-2xl border border-brand-line bg-white px-5 py-3.5 text-sm">
            <p className="font-bold text-slate-900">Nous trouver</p>
            <p className="line-clamp-2 text-slate-600">{data.association.address || SITE_LOCALITY}</p>
          </div>
          <a
            href={ASSOCIATION_PHONE_TEL}
            className="rounded-2xl border border-brand-line bg-white px-5 py-3.5 text-sm transition hover:border-brand-blue"
          >
            <p className="font-bold text-slate-900">{ASSOCIATION_PHONE_DISPLAY}</p>
            <p className="text-slate-600">Une question ? Appelez-nous</p>
          </a>
        </div>
      </section>

      {featuredNews || standalonePolls.length > 0 ? (
        <section id="actualites" className="anchor-section mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">Actualités</h2>
              <p className="mt-1.5 text-slate-600">Les prochains rendez-vous de l&apos;association.</p>
            </div>
            {data.news.length > 0 ? (
              <Link href="/actualites" className="text-[15px] font-bold text-brand-blue hover:underline">
                Toutes les actualités →
              </Link>
            ) : null}
          </div>

          {featuredNews ? (
            <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <NewsCard
                item={featuredNews}
                disciplines={data.disciplines}
                variant="feature"
                highlight={featuredNews.date >= todayParisIso() ? "Prochain rendez-vous" : "À la une"}
                hasOpenPoll={openPollNewsIds.has(featuredNews.id)}
              />
              {otherNews.length > 0 ? (
                <div className="grid content-start gap-5">
                  {otherNews.map((item) => (
                    <NewsCard
                      key={item.id}
                      item={item}
                      disciplines={data.disciplines}
                      hasOpenPoll={openPollNewsIds.has(item.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {standalonePolls.length > 0 ? (
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {standalonePolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section id="planning" className="anchor-section border-y border-brand-line bg-white py-12">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
          <div className="mb-7">
            <h2 className="section-title">{isSummerBreak ? "Planning de rentrée" : "Planning de la semaine"}</h2>
            <p className="mt-1.5 text-slate-600">
              Cliquez sur une séance pour voir les détails. Mis à jour en direct par le bureau.
            </p>
          </div>
          {isSummerBreak ? (
            <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Fermeture estivale : l&apos;association ne propose pas de cours jusqu&apos;au{" "}
              <strong>{formatDayLabelFr(resumeIso)}</strong>. Voici les horaires de la semaine de reprise.
            </p>
          ) : null}
          <WeekPlanner weeks={plannerWeeks} disciplines={plannerDisciplines} todayIso={todayParisIso()} />
        </div>
      </section>

      <section id="disciplines" className="anchor-section mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
        <div className="mb-7">
          <h2 className="section-title">Nos disciplines</h2>
          <p className="mt-1.5 text-slate-600">Des activités pour bouger, se détendre et s&apos;exprimer.</p>
        </div>

        <OrientationAssistant className="mb-7" />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {activeDisciplines.map((discipline) => {
            const sessions = describeDisciplineSessions(discipline.id, data.schedule);
            return (
              <Link
                key={discipline.id}
                href={`/disciplines/${discipline.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-brand-line bg-white transition hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(20,64,127,0.45)]"
              >
                <div className="relative aspect-[3/2] w-full bg-brand-blue/5">
                  <SiteImage
                    src={discipline.imageUrl}
                    alt={discipline.name}
                    fill
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-5">
                  <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-brand-blue">{discipline.name}</h3>
                  <p className="flex-1 text-sm text-slate-600">{limitSentences(discipline.description, 2)}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[13px] font-bold">
                    {sessions ? (
                      <span className="inline-flex items-center gap-2 text-brand-green-dark">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: colors[discipline.id]?.bg }}
                          aria-hidden
                        />
                        {sessions}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="shrink-0 text-brand-blue">Découvrir →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {latestPhotos.length > 0 ? (
        <section id="photos" className="anchor-section border-t border-brand-line bg-white py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="section-title">{data.homeGallery.title || "La vie de l'association"}</h2>
                <p className="mt-1.5 text-slate-600">Quelques moments récents. Cliquez sur une photo pour l&apos;agrandir.</p>
              </div>
            </div>
            <PhotoMosaic slides={latestPhotos} fallbackAlt={data.homeGallery.title || data.association.name} />
            {slides.length > latestPhotos.length ? (
              <div className="mt-6 text-center">
                <Link href="/galerie" className="btn btn-outline">
                  Voir toutes les photos ({slides.length})
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
