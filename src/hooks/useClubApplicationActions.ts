"use client";

import { useState } from "react";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";
import { reloadAtBureauDossiers } from "@/lib/bureau-navigation";

export function useClubApplicationActions() {
  const [message, setMessage] = useState("");

  async function updateApplication(applicationId: string, payload: ApplicationUpdatePayload) {
    const response = await fetch(`/api/club/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      reloadAtBureauDossiers();
      return;
    }
    const body = (await response.json()) as { message?: string };
    setMessage(body.message ?? "Erreur de mise à jour.");
  }

  async function validateEspace(applicationId: string) {
    const response = await fetch(`/api/club/applications/${applicationId}/validate-espace`, {
      method: "POST",
    });
    const body = (await response.json()) as { message?: string };
    if (response.ok) {
      setMessage(body.message ?? "Espace membre activé.");
      reloadAtBureauDossiers();
    } else {
      setMessage(body.message ?? "Impossible d'activer l'espace.");
    }
  }

  async function rejectApplication(applicationId: string) {
    const response = await fetch(`/api/club/applications/${applicationId}/reject`, {
      method: "POST",
    });
    const body = (await response.json()) as { message?: string };
    if (response.ok) {
      setMessage(body.message ?? "Dossier refusé.");
      reloadAtBureauDossiers();
    } else {
      setMessage(body.message ?? "Impossible de refuser le dossier.");
    }
  }

  async function requestDocument(applicationId: string, documentLabel: string) {
    const response = await fetch(`/api/club/applications/${applicationId}/request-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentLabel }),
    });
    const body = (await response.json()) as {
      message?: string;
      secureLink?: string;
      emailSent?: boolean;
    };
    if (response.ok) {
      setMessage(body.message ?? "Demande envoyée.");
      if (!body.emailSent && body.secureLink) {
        window.prompt(
          "SMTP non configuré : copiez ce lien public et transmettez-le à l'adhérent :",
          body.secureLink,
        );
      }
      reloadAtBureauDossiers();
    } else {
      setMessage(body.message ?? "Impossible d'envoyer la demande.");
    }
  }

  return {
    message,
    setMessage,
    updateApplication,
    validateEspace,
    rejectApplication,
    requestDocument,
  };
}
