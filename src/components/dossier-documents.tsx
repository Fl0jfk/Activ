"use client";

import { useRef, useState } from "react";
import PaymentReceiptLink from "@/components/payment-receipt-link";
import type { RegistrationApplication } from "@/lib/club-data";

type DocumentsSectionProps = {
  documents: RegistrationApplication["documents"];
  canUpload: boolean;
  showReceipt: boolean;
  applicationId: string;
  disabled: boolean;
  onUpload: (file: File, label: string) => Promise<boolean>;
};

export function documentsSummary(count: number): string {
  if (count === 0) return "Aucune pièce déposée";
  return count === 1 ? "1 pièce déposée" : `${count} pièces déposées`;
}

export default function DocumentsSection({
  documents,
  canUpload,
  showReceipt,
  applicationId,
  disabled,
  onUpload,
}: DocumentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  async function send() {
    if (!file) return;
    setUploading(true);
    try {
      const sent = await onUpload(file, label);
      if (sent) {
        setFile(null);
        setLabel("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sm text-slate-600">Aucune pièce jointe n’a été déposée pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => {
            const isS3 = doc.url.startsWith("s3://");
            const href = isS3 ? `/api/club/documents/file?url=${encodeURIComponent(doc.url)}` : doc.url;
            const isBulletin = doc.name.toLowerCase().includes("bulletin");
            return (
              <li
                key={`${doc.url}-${doc.uploadedAt}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-line bg-brand-cream/60 px-3 py-2"
              >
                <span className="text-break text-sm font-semibold text-slate-900">
                  {doc.name}
                  {isBulletin ? (
                    <span className="ml-2 inline-flex rounded-full bg-brand-green/15 px-2.5 py-0.5 text-xs font-bold text-brand-green-dark">
                      Bulletin signé
                    </span>
                  ) : null}
                </span>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm shrink-0"
                >
                  Ouvrir
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {showReceipt ? (
        <PaymentReceiptLink applicationId={applicationId} className="btn btn-outline btn-sm">
          Télécharger l’attestation de paiement
        </PaymentReceiptLink>
      ) : null}

      {canUpload ? (
        <div className="space-y-3 border-t border-brand-line pt-4">
          <p className="text-sm font-semibold text-slate-800">
            Ajouter une pièce pour l’adhérent (scan, photo, document papier…)
          </p>
          <label className="field-label">
            Nom de la pièce (facultatif)
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex. certificat médical"
              disabled={uploading || disabled}
              className="field"
            />
          </label>
          <label className="field-label">
            Fichier (PDF, JPG, PNG ou WEBP)
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              disabled={uploading || disabled}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="field"
            />
          </label>
          <button
            type="button"
            disabled={!file || uploading || disabled}
            onClick={() => void send()}
            className="btn btn-primary btn-sm"
          >
            {uploading ? "Envoi en cours…" : "Ajouter cette pièce"}
          </button>
          {!file ? <p className="text-sm text-slate-600">Choisissez d’abord un fichier.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
