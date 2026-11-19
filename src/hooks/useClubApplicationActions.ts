"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Feedback } from "@/components/bureau-ui";
import { fetchJson, jsonInit, type ApiResult } from "@/lib/fetch-json";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";

type Notice = { applicationId: string; feedback: NonNullable<Feedback> };

/** Lien public à transmettre à la main quand l’e-mail n’a pas pu partir. */
export type SecureLinkNotice = {
  applicationId: string;
  kind: "document" | "bulletin";
  link: string;
};

const NETWORK_ERROR_STATUS = 0;

/** Message d’erreur lisible : celui du serveur, sauf s’il parle de technique interne. */
function errorText(result: ApiResult<unknown>, fallback: string): string {
  if (result.status === NETWORK_ERROR_STATUS) return result.message;
  if (result.message && !/clerk/i.test(result.message)) return result.message;
  return fallback;
}

export function useClubApplicationActions() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [secureLink, setSecureLink] = useState<SecureLinkNotice | null>(null);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  function notify(applicationId: string, feedback: Feedback) {
    setNotice(feedback ? { applicationId, feedback } : null);
  }

  function feedbackFor(applicationId: string): Feedback {
    return notice && notice.applicationId === applicationId ? notice.feedback : null;
  }

  function secureLinkFor(applicationId: string): SecureLinkNotice | null {
    return secureLink && secureLink.applicationId === applicationId ? secureLink : null;
  }

  async function updateApplication(
    applicationId: string,
    payload: ApplicationUpdatePayload,
    successMessage = "Modifications enregistrées.",
  ): Promise<boolean> {
    notify(applicationId, null);
    const result = await fetchJson<{ message?: string; warning?: string }>(
      `/api/club/applications/${applicationId}`,
      jsonInit("PATCH", payload),
    );
    if (!result.ok) {
      notify(applicationId, {
        tone: "error",
        text: errorText(result, "La modification n’a pas pu être enregistrée. Réessayez dans un instant."),
      });
      return false;
    }
    // `warning` : message français prêt à afficher (compte de connexion, attestation non envoyée…).
    if (result.data?.warning) {
      notify(applicationId, {
        tone: "info",
        text: `${successMessage} Attention : ${result.data.warning}`,
      });
    } else {
      notify(applicationId, { tone: "success", text: successMessage });
    }
    refresh();
    return true;
  }

  /** Renvoie l’attestation de paiement à l’adhérent. */
  async function resendReceipt(applicationId: string): Promise<boolean> {
    notify(applicationId, null);
    const result = await fetchJson(`/api/club/applications/${applicationId}/receipt`, { method: "POST" });
    if (!result.ok) {
      notify(applicationId, {
        tone: "error",
        text: errorText(result, "L’attestation n’a pas pu être renvoyée. Réessayez dans un instant."),
      });
      return false;
    }
    notify(applicationId, { tone: "success", text: result.message || "Attestation envoyée." });
    refresh();
    return true;
  }

  async function validateEspace(applicationId: string, successMessage?: string): Promise<boolean> {
    notify(applicationId, null);
    const result = await fetchJson<{ warning?: string }>(
      `/api/club/applications/${applicationId}/validate-espace`,
      { method: "POST" },
    );
    if (!result.ok) {
      notify(applicationId, {
        tone: "error",
        text: errorText(
          result,
          "Impossible de valider l’espace adhérent. Réessayez dans un instant.",
        ),
      });
      return false;
    }
    if (result.data?.warning) {
      notify(applicationId, {
        tone: "info",
        text: `${successMessage ?? "Espace adhérent validé."} Attention : ${result.data.warning}`,
      });
    } else {
      notify(applicationId, {
        tone: "success",
        text: successMessage ?? "Espace adhérent validé : l’adhérent peut maintenant se connecter.",
      });
    }
    refresh();
    return true;
  }

  /**
   * `hadAccount` : le dossier avait un compte de connexion (supprimé en même temps que le refus).
   * `options.reason` : motif transmis à l’adhérent ; `options.force` : refus d’un dossier finalisé (président).
   */
  async function rejectApplication(
    applicationId: string,
    hadAccount = false,
    options: { reason?: string; force?: boolean } = {},
  ): Promise<boolean> {
    notify(applicationId, null);
    const result = await fetchJson<{ clerkDeleted?: boolean; warning?: string }>(
      `/api/club/applications/${applicationId}/reject`,
      jsonInit("POST", { reason: options.reason?.trim() || undefined, force: options.force === true }),
    );
    if (!result.ok) {
      notify(applicationId, {
        tone: "error",
        text: errorText(result, "Impossible de refuser le dossier. Réessayez dans un instant."),
      });
      return false;
    }
    if (result.data?.warning) {
      notify(applicationId, { tone: "info", text: result.message || `Dossier refusé. ${result.data.warning}` });
    } else {
      notify(applicationId, {
        tone: "success",
        text:
          result.message ||
          (hadAccount ? "Dossier refusé. L’accès de l’adhérent à son espace a été supprimé." : "Dossier refusé."),
      });
    }
    refresh();
    return true;
  }

  async function requestDocument(applicationId: string, documentLabel: string): Promise<boolean> {
    notify(applicationId, null);
    setSecureLink(null);
    const result = await fetchJson<{ secureLink?: string; emailSent?: boolean; warning?: string }>(
      `/api/club/applications/${applicationId}/request-document`,
      jsonInit("POST", { documentLabel }),
    );
    if (!result.ok) {
      notify(applicationId, {
        tone: "error",
        text: errorText(result, "Impossible d’envoyer la demande. Réessayez dans un instant."),
      });
      return false;
    }
    if (!result.data?.emailSent && result.data?.secureLink) {
      setSecureLink({ applicationId, kind: "document", link: result.data.secureLink });
      notify(applicationId, {
        tone: "info",
        text: "La demande est enregistrée, mais l’e-mail n’a pas pu partir (messagerie non configurée). Copiez le lien ci-dessous et transmettez-le vous-même à l’adhérent.",
      });
    } else if (result.data?.warning) {
      notify(applicationId, {
        tone: "info",
        text: `Demande envoyée : l’adhérent a reçu un e-mail avec un lien pour déposer sa pièce. Attention : ${result.data.warning}`,
      });
    } else {
      notify(applicationId, {
        tone: "success",
        text: "Demande envoyée : l’adhérent a reçu un e-mail avec un lien pour déposer sa pièce.",
      });
    }
    refresh();
    return true;
  }

  async function requestBulletinRevalidation(applicationId: string): Promise<boolean> {
    notify(applicationId, null);
    setSecureLink(null);
    const result = await fetchJson<{ secureLink?: string; emailSent?: boolean }>(
      `/api/club/applications/${applicationId}/request-bulletin-revalidation`,
      { method: "POST" },
    );
    if (!result.ok) {
      notify(applicationId, {
        tone: "error",
        text: errorText(result, "Impossible d’envoyer la demande. Réessayez dans un instant."),
      });
      return false;
    }
    if (!result.data?.emailSent && result.data?.secureLink) {
      setSecureLink({ applicationId, kind: "bulletin", link: result.data.secureLink });
      notify(applicationId, {
        tone: "info",
        text: "La demande est enregistrée, mais l’e-mail n’a pas pu partir (messagerie non configurée). Copiez le lien ci-dessous et transmettez-le vous-même à l’adhérent.",
      });
    } else {
      notify(applicationId, {
        tone: "success",
        text: "Demande envoyée : l’adhérent a reçu un lien pour revalider son bulletin.",
      });
    }
    refresh();
    return true;
  }

  async function uploadDocument(applicationId: string, file: File, label: string): Promise<boolean> {
    notify(applicationId, null);
    const formData = new FormData();
    formData.append("file", file);
    if (label.trim()) {
      formData.append("label", label.trim());
    }
    const result = await fetchJson(`/api/club/applications/${applicationId}/documents`, {
      method: "POST",
      body: formData,
    });
    if (!result.ok) {
      notify(applicationId, {
        tone: "error",
        text: errorText(result, "La pièce n’a pas pu être ajoutée. Vérifiez le fichier puis réessayez."),
      });
      return false;
    }
    notify(applicationId, { tone: "success", text: "Pièce ajoutée au dossier." });
    refresh();
    return true;
  }

  return {
    refreshing,
    feedbackFor,
    notify,
    secureLinkFor,
    dismissSecureLink: () => setSecureLink(null),
    updateApplication,
    resendReceipt,
    validateEspace,
    rejectApplication,
    requestDocument,
    requestBulletinRevalidation,
    uploadDocument,
  };
}

export type ClubApplicationActions = ReturnType<typeof useClubApplicationActions>;
