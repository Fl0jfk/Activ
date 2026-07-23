import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSiteData } from "@/lib/site-data";
import {
  formatEventSchedule,
  newsKindLabel,
  resolveNewsDisciplineLabel,
} from "@/lib/site-news";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ActualitePage({ params }: PageProps) {
  const { id } = await params;
  const data = await readSiteData();
  const item = data.news.find((entry) => entry.id === id);
  if (!item) {
    notFound();
  }

  const discipline = item.disciplineId
    ? data.disciplines.find((entry) => entry.id === item.disciplineId)
    : null;
  const gallery = item.galleryImages ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <Link href="/#actualites" className="text-sm font-semibold text-cyan-700 hover:underline">
        ← Retour aux actualités
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
            alt=""
            width={1000}
            height={560}
            unoptimized={item.imageUrl.startsWith("/api/")}
            className="mt-6 h-64 w-full rounded-2xl object-cover sm:h-80"
          />
        ) : null}

        {item.description ? (
          <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
            {item.description}
          </div>
        ) : null}

        {gallery.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-slate-900">Galerie</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {gallery.map((url) => (
                <Image
                  key={url}
                  src={url}
                  alt=""
                  width={640}
                  height={400}
                  unoptimized={url.startsWith("/api/")}
                  className="h-48 w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </section>
        ) : null}

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
