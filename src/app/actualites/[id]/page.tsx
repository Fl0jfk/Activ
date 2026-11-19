import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import LinkedPollsPanel from "@/components/linked-polls-panel";
import { RichTextContent } from "@/lib/chat-message-links";
import { absoluteUrl, buildPageMetadata, newsJsonLd, toMetaDescription } from "@/lib/seo";
import { readPublicSiteData } from "@/lib/site-data";
import {
  formatEventSchedule,
  newsKindLabel,
  resolveNewsDisciplineLabel,
} from "@/lib/site-news";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await readPublicSiteData();
  const item = data.news.find((entry) => entry.id === id);
  if (!item) return { title: "Actualité introuvable", robots: { index: false } };
  const schedule = formatEventSchedule(item);
  const fallback = [item.title, schedule, item.location].filter(Boolean).join(" – ");
  return buildPageMetadata({
    title: item.title,
    description: toMetaDescription(item.description || fallback),
    path: `/actualites/${item.id}`,
    image: item.imageUrl || undefined,
    imageAlt: item.title,
    type: "article",
  });
}

export default async function ActualitePage({ params }: PageProps) {
  const { id } = await params;
  const data = await readPublicSiteData();
  const item = data.news.find((entry) => entry.id === id);
  if (!item) {
    notFound();
  }

  const discipline = item.disciplineId
    ? data.disciplines.find((entry) => entry.id === item.disciplineId)
    : null;
  const gallery = item.galleryImages ?? [];
  const linkedPolls = data.polls.filter((poll) => poll.newsId === item.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <JsonLd data={newsJsonLd(item, absoluteUrl(`/actualites/${item.id}`))} />
      <Link href="/actualites" className="text-sm font-semibold text-brand-blue hover:underline">
        ← Toutes les actualités
      </Link>

      <article className="panel mt-4 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
          {newsKindLabel(item.kind)} · {resolveNewsDisciplineLabel(item.disciplineId, data.disciplines)}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{item.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{formatEventSchedule(item)}</p>
        {item.location ? <p className="mt-1 text-sm text-slate-600">Lieu : {item.location}</p> : null}

        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            width={1000}
            height={560}
            unoptimized={item.imageUrl.startsWith("/api/")}
            className="mt-6 h-64 w-full rounded-2xl object-cover sm:h-80"
          />
        ) : null}

        {item.description ? (
          <RichTextContent content={item.description} className="mt-6 text-base leading-relaxed text-slate-800" />
        ) : null}

        {gallery.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-slate-900">Galerie</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {gallery.map((url, index) => (
                <Image
                  key={url}
                  src={url}
                  alt={`${item.title} – photo ${index + 1}`}
                  width={640}
                  height={400}
                  unoptimized={url.startsWith("/api/")}
                  className="h-48 w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </section>
        ) : null}

        {linkedPolls.length > 0 ? <LinkedPollsPanel polls={linkedPolls} /> : null}

        {discipline ? (
          <p className="mt-8 text-sm text-slate-600">
            Discipline liée :{" "}
            <Link
              href={`/disciplines/${discipline.slug}`}
              className="font-semibold text-cyan-700 hover:underline"
            >
              {discipline.name}
            </Link>
          </p>
        ) : null}
      </article>
    </main>
  );
}
