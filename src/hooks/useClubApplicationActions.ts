"use client";

import { useState } from "react";
import type { ApplicationUpdatePayload } from "@/lib/club-mutations";

export function useClubApplicationActions() {
  const [message, setMessage] = useState("");

  async function updateApplication(applicationId: string, payload: ApplicationUpdatePayload) {
    const response = await fetch(`/api/club/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      window.location.reload();
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
      window.location.reload();
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
      window.location.reload();
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
    const body = (await response.json()) as { message?: string; secureLink?: string };
    if (response.ok) {
      setMessage(body.message ?? "Demande envoyée.");
      if (body.secureLink) {
        window.prompt("Lien sécurisé (à transmettre si l'e-mail n'est pas parti) :", body.secureLink);
      }
      window.location.reload();
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
