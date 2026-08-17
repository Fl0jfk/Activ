import type { SitePoll } from "@/lib/site-data-types";

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
