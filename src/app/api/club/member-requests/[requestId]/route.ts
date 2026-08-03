import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireClubOps } from "@/lib/api-auth";
import { readClubData, writeClubData, type MemberRequestDocument } from "@/lib/club-data";
import {
  notifyMemberRequestTreated,
} from "@/lib/member-request-notify";

export const dynamic = "force-dynamic";

function normalizeAttachment(value: unknown): MemberRequestDocument | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Partial<MemberRequestDocument>;
  if (
    typeof doc.name !== "string" ||
    !doc.name.trim() ||
    typeof doc.url !== "string" ||
    !doc.url.trim() ||
    typeof doc.uploadedAt !== "string"
  ) {
    return null;
  }
  return {
    name: doc.name.trim(),
    url: doc.url.trim(),
    uploadedAt: doc.uploadedAt,
  };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireClubOps();
  if (!auth.ok) {
    return auth.response;
  }

  const { requestId } = await context.params;

  try {
    const payload = (await request.json()) as {
      action?: "start" | "treat";
      bureauReply?: string;
      bureauAttachment?: unknown;
    };

    const data = await readClubData();
    const memberRequest = data.memberRequests.find((entry) => entry.id === requestId);
    if (!memberRequest) {
      return jsonError("Demande introuvable.", 404);
    }

    if (payload.action === "start") {
      if (memberRequest.status !== "received") {
        return jsonError("Seule une demande reçue peut passer en cours.", 400);
      }
      memberRequest.status = "in_progress";
      memberRequest.startedAt = new Date().toISOString();
      memberRequest.startedByUserId = auth.value.userId;
      await writeClubData(data);
      return jsonOk({ message: "Demande prise en charge.", request: memberRequest });
    }

    if (payload.action === "treat") {
      if (memberRequest.status === "treated") {
        return jsonError("Cette demande est déjà traitée.", 400);
      }
      const bureauReply = payload.bureauReply?.trim() ?? "";
      if (!bureauReply) {
        return jsonError("Ajoutez un message de réponse pour clôturer la demande.", 400);
      }
      if (bureauReply.length > 4000) {
        return jsonError("Le message de réponse est trop long.", 400);
      }

      if (!memberRequest.startedAt) {
        memberRequest.startedAt = new Date().toISOString();
        memberRequest.startedByUserId = auth.value.userId;
      }
      memberRequest.status = "treated";
      memberRequest.treatedAt = new Date().toISOString();
      memberRequest.treatedByUserId = auth.value.userId;
      memberRequest.bureauReply = bureauReply;
      memberRequest.bureauAttachment = normalizeAttachment(payload.bureauAttachment);

      await writeClubData(data);
      void notifyMemberRequestTreated(memberRequest);
      return jsonOk({ message: "Demande marquée comme traitée.", request: memberRequest });
    }

    return jsonError("Action invalide.", 400);
  } catch (error) {
    console.error("Failed to update member request", error);
    return jsonError("Erreur serveur.", 500);
  }
}
