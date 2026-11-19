/** Types et limites partagés entre l'API d'envoi groupé et l'écran « Communication ». */

export const BROADCAST_SUBJECT_MAX = 200;
export const BROADCAST_MESSAGE_MAX = 8000;

export type BroadcastRecipient = {
  email: string;
  name: string;
};

export type BroadcastFailure = {
  email: string;
  reason: "invalid_address" | "mailbox_unavailable" | "send_failed";
  detail: string;
};

/** Réponse de GET /api/club/broadcast-email (source de vérité des destinataires). */
export type BroadcastAudienceResponse = {
  recipientCount: number;
  recipients: BroadcastRecipient[];
  /** Présent uniquement quand aucun filtre n'est demandé : effectif par activité. */
  disciplineCounts?: Record<string, number>;
};

/** Réponse de POST /api/club/broadcast-email. */
export type BroadcastSendResponse = {
  message: string;
  sent: number;
  failed: number;
  failures: BroadcastFailure[];
  recipientCount: number;
  test?: boolean;
};
