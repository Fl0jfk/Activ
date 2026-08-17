import { cookies } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api-response";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import {
  POLL_VOTES_COOKIE,
  parsePollVotesCookie,
  serializePollVotesCookie,
} from "@/lib/site-polls";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ pollId: string }> },
) {
  const { pollId } = await context.params;

  try {
    const payload = (await request.json()) as { optionId?: string };
    const optionId = payload.optionId?.trim() ?? "";
    if (!optionId) {
      return jsonError("Choisissez une réponse.", 400);
    }

    const cookieStore = await cookies();
    const votes = parsePollVotesCookie(cookieStore.get(POLL_VOTES_COOKIE)?.value);
    if (votes[pollId]) {
      return jsonError("Vous avez déjà voté à ce sondage.", 409);
    }

    const data = await readSiteData();
    const poll = data.polls.find((entry) => entry.id === pollId);
    if (!poll) {
      return jsonError("Sondage introuvable.", 404);
    }
    if (poll.status !== "open") {
      return jsonError("Ce sondage est arrêté.", 400);
    }

    const option = poll.options.find((entry) => entry.id === optionId);
    if (!option) {
      return jsonError("Réponse introuvable.", 400);
    }

    option.votes += 1;
    votes[pollId] = optionId;
    await writeSiteData(data);

    cookieStore.set(POLL_VOTES_COOKIE, serializePollVotesCookie(votes), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return jsonOk({ message: "Vote enregistré.", poll });
  } catch (error) {
    console.error("Failed to vote on poll", error);
    return jsonError("Erreur serveur.", 500);
  }
}
