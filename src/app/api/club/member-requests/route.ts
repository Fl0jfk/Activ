import { jsonError, jsonOk } from "@/lib/api-response";
import { requireUser } from "@/lib/api-auth";
import { canAccessClubOperations, canAccessMemberSpace } from "@/lib/clerk";
import { readClubData, writeClubData, type MemberRequestDocument } from "@/lib/club-data";
import { randomId } from "@/lib/ids";
import { isOpenMemberRequest, sortMemberRequestsDesc } from "@/lib/member-request";
import { notifyBureauNewMemberRequest } from "@/lib/member-request-notify";

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

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const data = await readClubData();
    const requests = sortMemberRequestsDesc(data.memberRequests ?? []);

    if (canAccessClubOperations(auth.value)) {
      return jsonOk({
        open: requests.filter(isOpenMemberRequest),
        recent: requests.filter((request) => request.status === "treated").slice(0, 30),
        mine: requests.filter((request) => request.clerkUserId === auth.value.userId),
      });
    }

    return jsonOk({
      open: [],
      recent: [],
      mine: requests.filter((request) => request.clerkUserId === auth.value.userId),
    });
  } catch (error) {
    console.error("Failed to list member requests", error);
    return jsonError("Impossible de charger les demandes.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return auth.response;
  }

  if (!canAccessMemberSpace(auth.value) && !canAccessClubOperations(auth.value)) {
    return jsonError("Espace membre non accessible.", 403);
  }

  try {
    const payload = (await request.json()) as {
      subject?: string;
      message?: string;
      attachment?: unknown;
    };

    const subject = payload.subject?.trim() ?? "";
    const message = payload.message?.trim() ?? "";
    if (!subject || !message) {
      return jsonError("Objet et message sont requis.", 400);
    }
    if (subject.length > 120) {
      return jsonError("L'objet est trop long (120 caractères max).", 400);
    }
    if (message.length > 4000) {
      return jsonError("Le message est trop long.", 400);
    }

    const attachment = normalizeAttachment(payload.attachment);
    const data = await readClubData();
    const memberRequest = {
      id: randomId("mreq"),
      clerkUserId: auth.value.userId,
      memberName: auth.value.fullName,
      memberEmail: auth.value.email,
      subject,
      message,
      attachment,
      status: "received" as const,
      createdAt: new Date().toISOString(),
    };

    data.memberRequests = [memberRequest, ...(data.memberRequests ?? [])];
    await writeClubData(data);
    void notifyBureauNewMemberRequest(memberRequest);

    return jsonOk({ message: "Demande envoyée au bureau.", request: memberRequest }, 201);
  } catch (error) {
    console.error("Failed to create member request", error);
    return jsonError("Erreur serveur.", 500);
  }
}
