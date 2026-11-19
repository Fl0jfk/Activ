import { randomId } from "@/lib/ids";
import type { SitePoll, SitePollOption } from "@/lib/site-data-types";

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 8;

type PollsMergeResult = { ok: true; polls: SitePoll[] } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Version d’un sondage sans l’empreinte des votants (jamais envoyée au navigateur). */
export function stripVoterHashes(poll: SitePoll): SitePoll {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    newsId: poll.newsId,
    status: poll.status,
    createdAt: poll.createdAt,
    closedAt: poll.closedAt,
  };
}

/**
 * Fusionne les sondages envoyés par le bureau avec ceux du serveur.
 * Les votes, l’état (en cours / arrêté) et les empreintes des votants restent ceux du serveur :
 * un panneau ouvert depuis longtemps ne peut pas écraser les votes reçus entre-temps.
 * Les votes sont rattachés aux réponses par identifiant (jamais par position).
 */
export function mergePollsKeepingVotes(current: SitePoll[], incoming: unknown): PollsMergeResult {
  if (!Array.isArray(incoming)) {
    return { ok: false, message: "Format des sondages invalide." };
  }
  if (incoming.length > 500) {
    return { ok: false, message: "Trop de sondages envoyés." };
  }

  const polls: SitePoll[] = [];
  const seenPollIds = new Set<string>();

  for (const raw of incoming) {
    if (!isRecord(raw)) {
      return { ok: false, message: "Format des sondages invalide." };
    }
    const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : randomId("poll");
    if (seenPollIds.has(id)) {
      return { ok: false, message: "Un sondage apparaît deux fois dans la demande." };
    }
    seenPollIds.add(id);

    const question = typeof raw.question === "string" ? raw.question.trim() : "";
    if (!question) {
      return { ok: false, message: "La question du sondage est obligatoire." };
    }
    if (!Array.isArray(raw.options)) {
      return { ok: false, message: "Format des réponses du sondage invalide." };
    }

    const existing = current.find((entry) => entry.id === id);
    const options: SitePollOption[] = [];
    const seenOptionIds = new Set<string>();
    for (const rawOption of raw.options) {
      if (!isRecord(rawOption)) {
        return { ok: false, message: "Format des réponses du sondage invalide." };
      }
      const label = typeof rawOption.label === "string" ? rawOption.label.trim() : "";
      if (!label) continue;
      const optionId =
        typeof rawOption.id === "string" && rawOption.id.trim() ? rawOption.id.trim() : randomId("opt");
      if (seenOptionIds.has(optionId)) {
        return { ok: false, message: "Deux réponses d’un sondage ont le même identifiant." };
      }
      seenOptionIds.add(optionId);
      const previous = existing?.options.find((option) => option.id === optionId);
      options.push({ id: optionId, label, votes: previous?.votes ?? 0 });
    }
    if (options.length < POLL_MIN_OPTIONS) {
      return { ok: false, message: "Ajoutez au moins deux réponses au sondage." };
    }
    if (options.length > POLL_MAX_OPTIONS) {
      return { ok: false, message: "Un sondage ne peut pas avoir plus de 8 réponses." };
    }

    polls.push({
      id,
      question,
      options,
      newsId: typeof raw.newsId === "string" && raw.newsId.trim() ? raw.newsId.trim() : null,
      status: existing?.status ?? "open",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      closedAt: existing?.closedAt ?? null,
      voterHashes: existing?.voterHashes ?? [],
    });
  }

  return { ok: true, polls };
}

export const POLL_VOTES_COOKIE = "activ_poll_votes";
export const POLL_VOTES_STORAGE_KEY = "activ-poll-votes";

export function pollVoteTotal(poll: SitePoll): number {
  return poll.options.reduce((sum, option) => sum + option.votes, 0);
}

export function parsePollVotesCookie(value: string | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const votes: Record<string, string> = {};
    for (const [pollId, optionId] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof optionId === "string" && optionId) {
        votes[pollId] = optionId;
      }
    }
    return votes;
  } catch {
    return {};
  }
}

export function serializePollVotesCookie(votes: Record<string, string>): string {
  return JSON.stringify(votes);
}
