import { jsonError, jsonOk } from "@/lib/api-response";
import { requirePresident } from "@/lib/api-auth";
import { readSiteData, writeSiteData } from "@/lib/site-data";

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

  try {
    const payload = (await request.json()) as { action?: "close" | "open" | "delete" };
    const data = await readSiteData();
    const poll = data.polls.find((entry) => entry.id === pollId);
    if (!poll) {
      return jsonError("Sondage introuvable.", 404);
    }

    if (payload.action === "close") {
      poll.status = "closed";
      poll.closedAt = new Date().toISOString();
      await writeSiteData(data);
      return jsonOk({ message: "Sondage arrêté.", poll });
    }

    if (payload.action === "open") {
      poll.status = "open";
      poll.closedAt = null;
      await writeSiteData(data);
      return jsonOk({ message: "Sondage relancé.", poll });
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
