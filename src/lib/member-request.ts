import type { MemberRequest, MemberRequestStatus } from "@/lib/club-data";

export const MEMBER_REQUEST_STATUS_LABELS: Record<MemberRequestStatus, string> = {
  received: "Reçue",
  in_progress: "En cours",
  treated: "Traitée",
};

export function memberRequestStatusBadgeClass(status: MemberRequestStatus): string {
  if (status === "treated") return "bg-emerald-100 text-emerald-800";
  if (status === "in_progress") return "bg-amber-100 text-amber-900";
  return "bg-cyan-100 text-cyan-900";
}

export function isOpenMemberRequest(request: Pick<MemberRequest, "status">): boolean {
  return request.status === "received" || request.status === "in_progress";
}

export function sortMemberRequestsDesc(requests: MemberRequest[]): MemberRequest[] {
  return [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
