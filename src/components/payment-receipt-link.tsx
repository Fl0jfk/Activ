"use client";

import type { MouseEvent, ReactNode } from "react";

type PaymentReceiptLinkProps = {
  applicationId: string;
  className?: string;
  children: ReactNode;
};

/**
 * Télécharge une attestation fraîchement générée.
 * Le paramètre `t` contourne le cache navigateur/CDN et force la régénération du PDF.
 */
export default function PaymentReceiptLink({
  applicationId,
  className,
  children,
}: PaymentReceiptLinkProps) {
  const baseUrl = `/api/club/applications/${encodeURIComponent(applicationId)}/receipt`;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const link = document.createElement("a");
    link.href = `${baseUrl}?t=${Date.now()}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <a href={baseUrl} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
