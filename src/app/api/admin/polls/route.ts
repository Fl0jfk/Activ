import { jsonError, jsonOk } from "@/lib/api-response";
import { requirePresident } from "@/lib/api-auth";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, stripVoterHashes } from "@/lib/site-polls";
import { randomId } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requirePresident();
  if (!auth.ok) {
    return auth.response;
  }

  let payload: { question?: unknown; options?: unknown; newsId?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Demande invalide.", 400);
  }

  try {
    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    const options = (Array.isArray(payload.options) ? payload.options : [])
      .filter((label): label is string => typeof label === "string")
      .map((label) => label.trim())
      .filter(Boolean);
    const newsId = typeof payload.newsId === "string" && payload.newsId.trim() ? payload.newsId.trim() : null;

    if (!question) {
      return jsonError("La question est obligatoire.", 400);
    }
    if (options.length < POLL_MIN_OPTIONS) {
      return jsonError("Ajoutez au moins deux réponses.", 400);
    }
    if (options.length > POLL_MAX_OPTIONS) {
      return jsonError("Maximum 8 réponses.", 400);
    }

    const data = await readSiteData();
    if (newsId && !data.news.some((item) => item.id === newsId)) {
      return jsonError("Actualité introuvable pour lier ce sondage.", 400);
    }
    const poll = {
      id: randomId("poll"),
      question,
      options: options.map((label) => ({
        id: randomId("opt"),
        label,
        votes: 0,
      })),
      newsId,
      status: "open" as const,
      createdAt: new Date().toISOString(),
      closedAt: null,
      voterHashes: [],
    };
    data.polls = [poll, ...(data.polls ?? [])];
    await writeSiteData(data);

    return jsonOk({ message: "Sondage publié sur le site.", poll: stripVoterHashes(poll) }, 201);
  } catch (error) {
    console.error("Failed to create poll", error);
    return jsonError("Erreur serveur.", 500);
  }
}
