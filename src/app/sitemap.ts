import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { readPublicSiteData } from "@/lib/site-data";
import { sortNewsByDateDesc } from "@/lib/site-news";

export const dynamic = "force-dynamic";

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await readPublicSiteData();
  const news = sortNewsByDateDesc(data.news);
  const latestNewsDate = news.length > 0 ? parseDate(news[0].date) : undefined;

  return [
    { url: SITE_URL, lastModified: latestNewsDate, changeFrequency: "weekly", priority: 1 },
    ...data.disciplines
      .filter((discipline) => discipline.active)
      .map((discipline) => ({
        url: `${SITE_URL}/disciplines/${discipline.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    { url: `${SITE_URL}/preinscription`, changeFrequency: "monthly", priority: 0.7 },
    ...(news.length > 0
      ? [{ url: `${SITE_URL}/actualites`, lastModified: latestNewsDate, changeFrequency: "weekly" as const, priority: 0.7 }]
      : []),
    ...(data.homeGallery.slides.length > 0
      ? [{ url: `${SITE_URL}/galerie`, changeFrequency: "monthly" as const, priority: 0.4 }]
      : []),
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/association`, changeFrequency: "monthly", priority: 0.5 },
    ...news.map((item) => ({
      url: `${SITE_URL}/actualites/${item.id}`,
      lastModified: parseDate(item.date),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}
