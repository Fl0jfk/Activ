import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { RegistrationApplication } from "@/lib/club-data";
import { paymentMethodLabel } from "@/lib/dossier-workflow";
import { MEMBERSHIP_SEASON_LABEL } from "@/lib/membership-bulletin";
import { isAllowedSiteImageKey, readSiteImageObject } from "@/lib/s3-upload";
import type { AssociationData } from "@/lib/site-data-types";

function formatDateFr(isoDate?: string): string {
  const date = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatEuro(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} EUR`;
}

function siteImageKeyFromUrl(url: string): string | null {
  const marker = "/api/site-media/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const encoded = url.slice(index + marker.length).split("?")[0] ?? "";
  const key = encoded
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part))
    .join("/");
  return isAllowedSiteImageKey(key) ? key : null;
}

function resolveAmount(application: RegistrationApplication, disciplineAnnualFee?: string): string {
  const bulletinTotal = application.membershipBulletin?.grandTotal;
  if (typeof bulletinTotal === "number" && bulletinTotal > 0) {
    return formatEuro(bulletinTotal);
  }
  const fee = disciplineAnnualFee?.trim();
  if (fee) return fee;
  return "Selon tarif en vigueur";
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["-"];
}

async function embedStamp(pdfDoc: PDFDocument, stampImageUrl: string) {
  const key = siteImageKeyFromUrl(stampImageUrl);
  if (!key) return null;
  const image = await readSiteImageObject(key);
  if (!image) return null;
  const type = image.contentType.toLowerCase();
  try {
    if (type.includes("png")) return await pdfDoc.embedPng(image.body);
    if (type.includes("jpeg") || type.includes("jpg")) return await pdfDoc.embedJpg(image.body);
    try {
      return await pdfDoc.embedPng(image.body);
    } catch {
      return await pdfDoc.embedJpg(image.body);
    }
  } catch (error) {
    console.error("Unable to embed association stamp on receipt", error);
    return null;
  }
}

export async function buildPaymentReceiptPdf(params: {
  application: RegistrationApplication;
  siteData: AssociationData;
  paidAt?: string;
}): Promise<Uint8Array> {
  const { application, siteData } = params;
  const association = siteData.association;
  const disciplineEntry = siteData.disciplines.find((entry) => entry.id === application.disciplineId);
  const discipline = disciplineEntry?.name ?? "Association";
  const amount = resolveAmount(application, disciplineEntry?.annualFee);
  const paidAtLabel = formatDateFr(params.paidAt);
  const memberName = application.fullName.trim() || `${application.firstName} ${application.lastName}`.trim();
  const receiptNumber = `R-${application.id.slice(-8).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  const addressLine = [application.address, application.postalCode, application.city].filter(Boolean).join(", ") || "-";

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.16, 0.22);
  const muted = rgb(0.35, 0.4, 0.48);
  const accent = rgb(0.08, 0.45, 0.52);
  const paper = rgb(0.97, 0.98, 0.99);

  page.drawRectangle({
    x: 36,
    y: 36,
    width: 523.28,
    height: 769.89,
    borderColor: accent,
    borderWidth: 1.2,
    color: paper,
  });

  let y = 760;
  const left = 56;

  const draw = (text: string, options?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; gap?: number }) => {
    const size = options?.size ?? 10;
    page.drawText(text, {
      x: left,
      y,
      size,
      font: options?.bold ? fontBold : font,
      color: options?.color ?? ink,
    });
    y -= options?.gap ?? size + 6;
  };

  draw(association.name || "Association", { bold: true, size: 16, gap: 16 });
  if (association.tagline) draw(association.tagline, { size: 10, color: muted, gap: 14 });
  if (association.address) draw(association.address, { size: 9, color: muted, gap: 12 });
  if (association.city) draw(association.city, { size: 9, color: muted, gap: 12 });
  if (association.contactEmail) draw(association.contactEmail, { size: 9, color: muted, gap: 18 });

  draw("RECU DE PAIEMENT", { bold: true, size: 18, gap: 14 });
  draw(`N. ${receiptNumber}`, { size: 9, color: muted, gap: 22 });

  draw("L'association certifie avoir bien recu le paiement suivant.", { size: 11, gap: 20 });

  const rows: Array<[string, string]> = [
    ["Date du recu", paidAtLabel],
    ["Adherent", memberName],
    ["E-mail", application.email || "-"],
    ["Adresse", addressLine],
    ["Discipline", discipline],
    ["Saison", MEMBERSHIP_SEASON_LABEL],
    ["Mode de paiement", paymentMethodLabel(application.paymentMethod)],
    ["Montant", amount],
  ];
  if (application.licenseEndDate) {
    rows.push(["Licence valable jusqu'au", formatDateFr(`${application.licenseEndDate}T12:00:00`)]);
  }

  for (const [label, value] of rows) {
    const valueLines = wrapText(value, 48);
    page.drawText(`${label} :`, {
      x: left,
      y,
      size: 10,
      font: fontBold,
      color: ink,
    });
    page.drawText(valueLines[0] ?? "-", {
      x: 210,
      y,
      size: 10,
      font,
      color: ink,
    });
    y -= 16;
    for (const extraLine of valueLines.slice(1)) {
      page.drawText(extraLine, {
        x: 210,
        y,
        size: 10,
        font,
        color: ink,
      });
      y -= 16;
    }
  }

  y -= 12;
  draw(
    "Ce document atteste de la reception du paiement par l'association.",
    { size: 8, color: muted, gap: 12 },
  );
  draw("Il ne constitue pas une facture. Conservez ce recu pour vos dossiers.", { size: 8, color: muted, gap: 24 });

  const stamp = association.stampImageUrl ? await embedStamp(pdfDoc, association.stampImageUrl) : null;
  if (stamp) {
    const scaled = stamp.scaleToFit(130, 130);
    const stampY = Math.max(70, y - scaled.height + 10);
    page.drawImage(stamp, {
      x: 400,
      y: stampY,
      width: scaled.width,
      height: scaled.height,
    });
    page.drawText("Cachet de l'association", {
      x: 400,
      y: Math.max(56, stampY - 12),
      size: 8,
      font,
      color: muted,
    });
  } else {
    page.drawText("Cachet de l'association", {
      x: 400,
      y: 90,
      size: 8,
      font,
      color: muted,
    });
    page.drawRectangle({
      x: 400,
      y: 104,
      width: 120,
      height: 80,
      borderColor: rgb(0.75, 0.78, 0.82),
      borderWidth: 0.8,
    });
  }

  page.drawText("Document genere automatiquement par l'espace bureau Activ'.", {
    x: left,
    y: 52,
    size: 8,
    font,
    color: muted,
  });

  return pdfDoc.save();
}
