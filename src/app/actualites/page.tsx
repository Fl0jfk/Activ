import type { Metadata } from "next";
import Link from "next/link";
import NewsCard from "@/components/news-card";
import PollCard from "@/components/poll-card";
import { splitNewsByDate } from "@/lib/public-site";
import { buildPageMetadata, SITE_LOCALITY } from "@/lib/seo";
import { readPublicSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Actualités et événements",
  description: `Toutes les actualités d'Activ' Sainte-Croix : événements, randonnées, ateliers et informations pratiques à ${SITE_LOCALITY}.`,
  path: "/actualites",
});

export default async function ActualitesPage() {
  const data = await readPublicSiteData();
  const { upcoming, past } = splitNewsByDate(data.news);
  const openPollNewsIds = new Set(
    data.polls.filter((poll) => poll.status === "open" && poll.newsId).map((poll) => poll.newsId as string),
  );
  const standalonePolls = data.polls
    .filter((poll) => !poll.newsId)
    .sort((a, b) => Number(b.status === "open") - Number(a.status === "open"));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <Link href="/" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Retour à l&apos;accueil
      </Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">Actualités</h1>
      <p className="mt-2 text-slate-600">Les rendez-vous et les nouvelles de l&apos;association.</p>

      {upcoming.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl font-extrabold text-slate-900">À venir</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {upcoming.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                disciplines={data.disciplines}
                hasOpenPoll={openPollNewsIds.has(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {standalonePolls.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl font-extrabold text-slate-900">Sondages</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {standalonePolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl font-extrabold text-slate-900">{upcoming.length > 0 ? "Déjà passées" : "Dernières actualités"}</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {past.map((item) => (
              <NewsCard key={item.id} item={item} disciplines={data.disciplines} />
            ))}
          </div>
        </section>
      ) : null}

      {data.news.length === 0 && standalonePolls.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-brand-line bg-white px-5 py-8 text-center text-slate-600">
          Aucune actualité pour le moment.
        </p>
      ) : null}
    </main>
  );
}
