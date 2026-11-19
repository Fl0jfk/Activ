import { jsonError, jsonOk } from "@/lib/api-response";
import { requirePresident } from "@/lib/api-auth";
import { readSiteData, writeSiteData } from "@/lib/site-data";
import { stripVoterHashes } from "@/lib/site-polls";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pollId: string }> },
) {
  const auth = await requirePresident();
  if (!auth.ok) {
    return auth.response;
  }

  const { pollId } = await context.params;

  let payload: { action?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return jsonError("Demande invalide.", 400);
  }

  try {
    const data = await readSiteData();
    const poll = data.polls.find((entry) => entry.id === pollId);
    if (!poll) {
      return jsonError("Sondage introuvable.", 404);
    }

    if (payload.action === "close") {
      poll.status = "closed";
      poll.closedAt = new Date().toISOString();
      await writeSiteData(data);
      return jsonOk({ message: "Sondage arrêté.", poll: stripVoterHashes(poll) });
    }

    if (payload.action === "open") {
      poll.status = "open";
      poll.closedAt = null;
      await writeSiteData(data);
      return jsonOk({ message: "Sondage relancé.", poll: stripVoterHashes(poll) });
    }

    if (payload.action === "delete") {
      data.polls = data.polls.filter((entry) => entry.id !== pollId);
      await writeSiteData(data);
      return jsonOk({ message: "Sondage supprimé." });
    }

    return jsonError("Action invalide.", 400);
  } catch (error) {
    console.error("Failed to update poll", error);
    return jsonError("Erreur serveur.", 500);
  }
}
