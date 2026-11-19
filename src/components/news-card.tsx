import Link from "next/link";
import SiteImage from "@/components/site-image";
import { todayParisIso } from "@/lib/schedule-week";
import type { SiteNewsItem } from "@/lib/site-data-types";
import {
  formatEventSchedule,
  newsKindLabel,
  resolveNewsDisciplineLabel,
  truncateNewsDescription,
} from "@/lib/site-news";

type NewsCardProps = {
  item: SiteNewsItem;
  disciplines: { id: string; name: string }[];
  variant?: "feature" | "compact";
  /** Libellé du badge d'en-tête (ex. « Prochain rendez-vous »). */
  highlight?: string;
  hasOpenPoll?: boolean;
};

function Badges({
  item,
  disciplines,
  highlight,
  hasOpenPoll,
}: Pick<NewsCardProps, "item" | "disciplines" | "highlight" | "hasOpenPoll">) {
  const isPast = !item.date || item.date < todayParisIso();
  const topic = item.disciplineId
    ? resolveNewsDisciplineLabel(item.disciplineId, disciplines)
    : newsKindLabel(item.kind);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {highlight ? (
        <span className="rounded-full bg-brand-pink/12 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#b61f63]">
          {highlight}
        </span>
      ) : isPast ? (
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Passé</span>
      ) : null}
      <span className="rounded-full bg-brand-green/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-green-dark">
        {topic}
      </span>
      {hasOpenPoll ? (
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-violet-800">
          Sondage en cours
        </span>
      ) : null}
    </div>
  );
}

export default function NewsCard({ item, disciplines, variant = "compact", highlight, hasOpenPoll }: NewsCardProps) {
  const feature = variant === "feature";
  const schedule = formatEventSchedule(item);

  return (
    <Link
      href={`/actualites/${item.id}`}
      className={`group grid overflow-hidden rounded-3xl border border-brand-line bg-white transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-26px_rgba(20,64,127,0.5)] ${
        feature ? "sm:grid-cols-[minmax(0,240px)_1fr]" : "grid-cols-[110px_1fr] sm:grid-cols-[130px_1fr]"
      }`}
    >
      <div
        className={`relative bg-brand-blue/5 ${feature ? "h-72 sm:h-auto sm:min-h-[300px]" : "min-h-[140px]"}`}
      >
        {item.imageUrl ? (
          <SiteImage
            src={item.imageUrl}
            alt=""
            fill
            sizes={feature ? "(min-width: 640px) 240px, 100vw" : "130px"}
            className="object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl text-brand-blue/30" aria-hidden>
            ★
          </div>
        )}
      </div>
      <div className={`flex min-w-0 flex-col gap-2 ${feature ? "p-6 sm:p-7" : "p-4 sm:p-5"}`}>
        <Badges item={item} disciplines={disciplines} highlight={highlight} hasOpenPoll={hasOpenPoll} />
        <h3 className={`font-extrabold leading-snug text-slate-900 ${feature ? "text-2xl" : "text-base sm:text-lg"}`}>
          {item.title}
        </h3>
        {schedule ? <p className="text-sm font-semibold text-slate-700">{schedule}</p> : null}
        {item.location ? <p className="text-sm text-slate-600">{item.location}</p> : null}
        {feature && item.description ? (
          <p className="text-break text-sm text-slate-600">{truncateNewsDescription(item.description, 200)}</p>
        ) : null}
        <span className="mt-auto pt-1 text-sm font-bold text-brand-blue group-hover:underline">
          {item.ctaLabel?.trim() || "Lire la suite"} →
        </span>
      </div>
    </Link>
  );
}
