"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Discipline, SiteNewsItem, SitePoll } from "@/lib/site-data-types";
import {
  formatEventSchedule,
  newsKindLabel,
  resolveNewsDisciplineLabel,
  truncateNewsDescription,
} from "@/lib/site-news";
import { POLL_VOTES_STORAGE_KEY, pollVoteTotal } from "@/lib/site-polls";

const AUTO_MS = 6500;

type HomeFeedSliderProps = {
  news: SiteNewsItem[];
  polls: SitePoll[];
  disciplines: Pick<Discipline, "id" | "name">[];
};

type FeedSlide =
  | { kind: "news"; id: string; item: SiteNewsItem }
  | { kind: "poll"; id: string; item: SitePoll };

function readStoredVotes(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(POLL_VOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function buildSlides(news: SiteNewsItem[], polls: SitePoll[]): FeedSlide[] {
  const openPolls = polls.filter((poll) => poll.status === "open");
  const closedPolls = polls.filter((poll) => poll.status !== "open");
  return [
    ...openPolls.map((item) => ({ kind: "poll" as const, id: `poll-${item.id}`, item })),
    ...news.map((item) => ({ kind: "news" as const, id: `news-${item.id}`, item })),
    ...closedPolls.map((item) => ({ kind: "poll" as const, id: `poll-${item.id}`, item })),
  ];
}

export default function HomeFeedSlider({ news, polls, disciplines }: HomeFeedSliderProps) {
  const slides = useMemo(() => buildSlides(news, polls), [news, polls]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [pollItems, setPollItems] = useState(polls);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setVotes(readStoredVotes());
  }, []);

  useEffect(() => {
    setPollItems(polls);
  }, [polls]);

  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setIndex(((next % slides.length) + slides.length) % slides.length);
      setProgressKey((key) => key + 1);
    },
    [slides.length],
  );

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const clearStickyPause = () => {
      if (!mq.matches) setPaused(false);
    };
    clearStickyPause();
    mq.addEventListener("change", clearStickyPause);
    return () => mq.removeEventListener("change", clearStickyPause);
  }, []);

  useEffect(() => {
    if (index >= slides.length && slides.length > 0) {
      setIndex(0);
    }
  }, [index, slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || paused || busyPollId) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % slides.length);
      setProgressKey((key) => key + 1);
    }, AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [slides.length, paused, index, busyPollId]);

  function pauseIfDesktopHover() {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      setPaused(true);
    }
  }

  if (slides.length === 0) {
    return null;
  }

  const current = slides[index] ?? slides[0]!;
  const autoplay = slides.length > 1;
  const currentPoll =
    current.kind === "poll" ? pollItems.find((entry) => entry.id === current.item.id) ?? current.item : null;

  return (
    <section
      id="actualites"
      className="anchor-section panel mt-8 overflow-hidden p-6 sm:p-8"
      onMouseEnter={pauseIfDesktopHover}
      onMouseLeave={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="panel-title">Actualités de l&apos;association</h2>
          <p className="mt-1 text-sm text-slate-600">
            Infos, événements et sondages. Survolez pour mettre le défilement en pause.
          </p>
        </div>
        {autoplay ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-700"
              aria-label="Élément précédent"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-700"
              aria-label="Élément suivant"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}

      <div className="relative mt-4 min-h-[18rem]">
        {slides.map((slide, slideIndex) => {
          const active = slideIndex === index;
          return (
            <div
              key={slide.id}
              className={`transition-opacity duration-500 ${
                active ? "relative z-10 opacity-100" : "pointer-events-none absolute inset-0 z-0 opacity-0"
              }`}
              aria-hidden={!active}
            >
              {slide.kind === "news" ? (
                <NewsSlide item={slide.item} disciplines={disciplines} />
              ) : (
                <PollCard
                  poll={
                    (active ? currentPoll : pollItems.find((entry) => entry.id === slide.item.id)) ?? slide.item
                  }
                  votedOptionId={votes[slide.item.id]}
                  busy={busyPollId === slide.item.id}
                  onVoted={(nextPoll, optionId) => {
                    setPollItems((current) =>
                      current.map((entry) => (entry.id === nextPoll.id ? nextPoll : entry)),
                    );
                    const nextVotes = { ...votes, [slide.item.id]: optionId };
                    setVotes(nextVotes);
                    window.localStorage.setItem(POLL_VOTES_STORAGE_KEY, JSON.stringify(nextVotes));
                  }}
                  onBusy={(busy) => setBusyPollId(busy ? slide.item.id : null)}
                  onMessage={setMessage}
                />
              )}
            </div>
          );
        })}
      </div>

      {autoplay ? (
        <div className="mt-4 flex justify-center gap-2">
          {slides.map((slide, slideIndex) => {
            const active = slideIndex === index;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(slideIndex)}
                className={`relative h-2.5 overflow-hidden rounded-full transition-all ${
                  active ? "w-8 bg-orange-200" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Aller à l'élément ${slideIndex + 1}`}
                aria-current={active}
              >
                {active && !paused && !busyPollId ? (
                  <span
                    key={progressKey}
                    className="absolute inset-y-0 left-0 rounded-full bg-orange-600"
                    style={{ animation: `home-gallery-progress ${AUTO_MS}ms linear forwards` }}
                  />
                ) : active ? (
                  <span className="absolute inset-0 rounded-full bg-orange-600" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function NewsSlide({
  item,
  disciplines,
}: {
  item: SiteNewsItem;
  disciplines: Pick<Discipline, "id" | "name">[];
}) {
  return (
    <Link
      href={`/actualites/${item.id}`}
      className="block overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-amber-50 to-orange-100 p-4 transition hover:shadow-md sm:p-5"
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          width={960}
          height={420}
          loading="eager"
          unoptimized={item.imageUrl.startsWith("/api/")}
          className="mb-3 h-44 w-full rounded-xl object-cover sm:h-56"
        />
      ) : null}
      <p className="text-xs font-semibold uppercase text-orange-700">
        Actualité · {newsKindLabel(item.kind)} · {resolveNewsDisciplineLabel(item.disciplineId, disciplines)}
      </p>
      <h3 className="mt-1 text-xl font-bold text-slate-900">{item.title}</h3>
      <p className="mt-1 text-sm text-slate-700">{formatEventSchedule(item)}</p>
      {item.location ? <p className="mt-1 text-sm text-slate-600">Lieu : {item.location}</p> : null}
      {item.description ? (
        <p className="mt-2 text-sm text-slate-700">{truncateNewsDescription(item.description, 220)}</p>
      ) : null}
      <span className="mt-3 inline-block text-sm font-semibold text-orange-800">Lire la suite →</span>
    </Link>
  );
}

function PollCard({
  poll,
  votedOptionId,
  busy,
  onVoted,
  onBusy,
  onMessage,
}: {
  poll: SitePoll;
  votedOptionId?: string;
  busy: boolean;
  onVoted: (poll: SitePoll, optionId: string) => void;
  onBusy: (busy: boolean) => void;
  onMessage: (message: string) => void;
}) {
  const [selected, setSelected] = useState(votedOptionId ?? "");
  const closed = poll.status === "closed";
  const showResults = closed || Boolean(votedOptionId);
  const total = useMemo(() => pollVoteTotal(poll), [poll]);

  useEffect(() => {
    if (votedOptionId) setSelected(votedOptionId);
  }, [votedOptionId]);

  async function vote() {
    if (!selected) {
      onMessage("Choisissez une réponse avant de voter.");
      return;
    }
    onBusy(true);
    onMessage("");
    const response = await fetch(`/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: selected }),
    });
    const payload = (await response.json()) as { message?: string; poll?: SitePoll };
    if (response.ok && payload.poll) {
      onVoted(payload.poll, selected);
      onMessage("Merci, votre vote est enregistré.");
    } else if (response.status === 409) {
      onVoted(poll, selected);
      onMessage("Vous avez déjà voté à ce sondage.");
    } else {
      onMessage(payload.message ?? "Impossible d'enregistrer le vote.");
    }
    onBusy(false);
  }

  return (
    <article className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase text-violet-800">Sondage</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-bold text-slate-900">{poll.question}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            closed ? "bg-slate-200 text-slate-700" : "bg-violet-100 text-violet-800"
          }`}
        >
          {closed ? "Terminé" : "En cours"}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const percent = total > 0 ? Math.round((option.votes / total) * 100) : 0;
          const isChoice = selected === option.id;
          return (
            <li key={option.id}>
              {showResults ? (
                <div>
                  <div className="flex justify-between text-sm text-slate-700">
                    <span className={isChoice ? "font-semibold" : ""}>
                      {option.label}
                      {isChoice ? " (votre vote)" : ""}
                    </span>
                    <span className="font-semibold">{percent} %</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-violet-100">
                    <div className="h-full rounded-full bg-violet-600" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name={poll.id}
                    value={option.id}
                    checked={isChoice}
                    onChange={() => setSelected(option.id)}
                    disabled={busy || closed}
                  />
                  {option.label}
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {!closed && !votedOptionId ? (
        <button
          type="button"
          onClick={() => void vote()}
          disabled={busy}
          className="mt-4 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Voter"}
        </button>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          {total} vote{total > 1 ? "s" : ""}
        </p>
      )}
    </article>
  );
}
