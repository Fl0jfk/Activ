import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";
import type { RegistrationApplication } from "@/lib/club-data";
import { paymentMethodLabel } from "@/lib/dossier-workflow";
import { MEMBERSHIP_ADHESION_FEE, MEMBERSHIP_SEASON_LABEL } from "@/lib/membership-bulletin";
import { buildMembershipActivityCatalog, membershipActivityLabels } from "@/lib/membership-activities";
import { isAllowedSiteImageKey, readSiteImageObject } from "@/lib/s3-upload";
import type { AssociationData } from "@/lib/site-data-types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.09, 0.13, 0.19);
const MUTED = rgb(0.39, 0.45, 0.55);
const LINE = rgb(0.84, 0.88, 0.92);
const ACCENT = rgb(0.03, 0.45, 0.53);

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

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of word) {
    const next = `${current}${char}`;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [word];
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      const chunks = splitLongWord(word, font, size, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] ?? "";
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function limitLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[kept.length - 1] = `${kept[kept.length - 1]}...`;
  return kept;
}

function paymentAmount(application: RegistrationApplication): number | null {
  if (typeof application.amountPaid === "number" && Number.isFinite(application.amountPaid)) {
    return application.amountPaid;
  }
  const bulletinTotal = application.membershipBulletin?.grandTotal;
  if (typeof bulletinTotal === "number" && bulletinTotal > 0) {
    return bulletinTotal;
  }
  return null;
}

function disciplineNames(
  application: RegistrationApplication,
  siteData: AssociationData,
): string[] {
  const ids =
    application.disciplineIds && application.disciplineIds.length > 0
      ? application.disciplineIds
      : application.disciplineId
        ? [application.disciplineId]
        : [];
  const names = ids
    .map((id) => siteData.disciplines.find((entry) => entry.id === id)?.name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names : ["Association"];
}

function presidentName(siteData: AssociationData): string {
  const members = siteData.association.organisation?.boardMembers ?? [];
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const president =
    members.find(
      (member) =>
        normalized(member.role).includes("president") &&
        !normalized(member.role).includes("vice"),
    ) ?? members.find((member) => normalized(member.role).includes("president"));
  return president?.fullName?.trim() ?? "";
}

async function embedStoredImage(pdfDoc: PDFDocument, imageUrl: string): Promise<PDFImage | null> {
  const key = siteImageKeyFromUrl(imageUrl);
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
    console.error("Unable to embed picture on payment receipt", error);
    return null;
  }
}

async function embedAssociationLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "logo.png"));
    return await pdfDoc.embedPng(bytes);
  } catch {
    // Fallback for deployments where public files are not exposed on disk.
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!baseUrl) return null;
  try {
    const response = await fetch(`${baseUrl}/logo.png`);
    if (!response.ok) return null;
    return await pdfDoc.embedPng(new Uint8Array(await response.arrayBuffer()));
  } catch (error) {
    console.error("Unable to embed association logo on payment receipt", error);
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
  const paidAtLabel = formatDateFr(params.paidAt);
  const memberName =
    application.fullName.trim() || `${application.firstName} ${application.lastName}`.trim();
  const receiptNumber = `A-${application.id.slice(-8).toUpperCase()}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}`;
  const addressLine =
    [application.address, application.postalCode, application.city].filter(Boolean).join(", ") || "-";

  const catalog = buildMembershipActivityCatalog(siteData);
  const storedLabels = application.membershipBulletin?.selectedActivityLabels;
  const activityLabels =
    storedLabels && storedLabels.length > 0
      ? storedLabels
      : membershipActivityLabels(application.membershipBulletin?.selectedSlots ?? [], catalog);
  const activities =
    activityLabels.length > 0 ? activityLabels : disciplineNames(application, siteData);

  const paidAmount = paymentAmount(application);
  const bulletin = application.membershipBulletin;
  const disciplineEntry = siteData.disciplines.find(
    (entry) => entry.id === application.disciplineId,
  );
  const fallbackAmount = disciplineEntry?.annualFee?.trim() || "Selon tarif en vigueur";

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedAssociationLogo(pdfDoc);

  const left = MARGIN;
  const right = PAGE_WIDTH - MARGIN;

  const draw = (
    text: string,
    x: number,
    y: number,
    options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(text, {
      x,
      y,
      size: options.size ?? 9,
      font: options.bold ? fontBold : font,
      color: options.color ?? INK,
    });
  };

  const drawRight = (
    text: string,
    y: number,
    options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const size = options.size ?? 9;
    const usedFont = options.bold ? fontBold : font;
    page.drawText(text, {
      x: right - usedFont.widthOfTextAtSize(text, size),
      y,
      size,
      font: usedFont,
      color: options.color ?? INK,
    });
  };

  const drawParagraph = (
    text: string,
    options: {
      x: number;
      y: number;
      width: number;
      size: number;
      lineHeight: number;
      color?: ReturnType<typeof rgb>;
      bold?: boolean;
      maxLines?: number;
    },
  ): number => {
    const usedFont = options.bold ? fontBold : font;
    const lines = limitLines(
      wrapText(text, usedFont, options.size, options.width),
      options.maxLines ?? 4,
    );
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: options.x,
        y: options.y - index * options.lineHeight,
        size: options.size,
        font: usedFont,
        color: options.color ?? INK,
      });
    });
    return options.y - lines.length * options.lineHeight;
  };

  // Fine bandeau d'accent, le reste de la page reste blanc.
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 4,
    width: PAGE_WIDTH,
    height: 4,
    color: ACCENT,
  });

  /* ---------------------------------- En-tête --------------------------------- */

  const headerTop = PAGE_HEIGHT - 42;

  if (logo) {
    const scaled = logo.scaleToFit(66, 56);
    page.drawImage(logo, {
      x: left,
      y: headerTop - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
  } else {
    const initials = (association.name || "A")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
    page.drawCircle({
      x: left + 30,
      y: headerTop - 28,
      size: 28,
      borderColor: ACCENT,
      borderWidth: 1.4,
    });
    const size = 18;
    draw(initials, left + 30 - fontBold.widthOfTextAtSize(initials, size) / 2, headerTop - 34, {
      bold: true,
      size,
      color: ACCENT,
    });
  }

  const infoX = left + 86;
  let infoY = headerTop - 2;

  const associationNameLines = limitLines(
    wrapText(association.name || "Association", fontBold, 12, 240),
    2,
  );
  associationNameLines.forEach((line, index) => {
    draw(line, infoX, infoY - index * 15, { bold: true, size: 12 });
  });
  infoY -= associationNameLines.length * 15 + 2;

  const infoLines = [
    association.tagline,
    association.address,
    association.city,
    association.contactEmail,
    association.siret?.trim() ? `SIRET : ${association.siret.trim()}` : "",
    association.rna?.trim() ? `RNA : ${association.rna.trim()}` : "",
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .flatMap((value) => limitLines(wrapText(value, font, 8.5, 240), 2));

  infoLines.forEach((line) => {
    draw(line, infoX, infoY, { size: 8.5, color: MUTED });
    infoY -= 11;
  });

  let titleY = headerTop;
  drawRight("ATTESTATION", titleY, { bold: true, size: 19, color: ACCENT });
  titleY -= 20;
  drawRight("DE PAIEMENT", titleY, { bold: true, size: 19, color: ACCENT });
  titleY -= 17;
  drawRight(`N° ${receiptNumber}`, titleY, { size: 8.5, color: MUTED });
  titleY -= 12;
  drawRight(`Émise le ${formatDateFr()}`, titleY, { size: 8.5, color: MUTED });

  const headerBottom = Math.min(infoY, titleY) - 16;
  page.drawLine({
    start: { x: left, y: headerBottom },
    end: { x: right, y: headerBottom },
    thickness: 1.2,
    color: ACCENT,
  });

  let y = headerBottom - 26;

  /* -------------------------------- Coordonnées ------------------------------- */

  const metaTop = y;
  let memberY = metaTop;

  memberY = drawParagraph("ADHÉRENT", {
    x: left,
    y: memberY,
    width: 260,
    size: 7.5,
    lineHeight: 10,
    color: ACCENT,
    bold: true,
  }) - 2;

  memberY = drawParagraph(memberName || "Adhérent", {
    x: left,
    y: memberY,
    width: 260,
    size: 12,
    lineHeight: 15,
    maxLines: 1,
    bold: true,
  }) - 2;

  memberY = drawParagraph(addressLine, {
    x: left,
    y: memberY,
    width: 260,
    size: 9,
    lineHeight: 12,
    color: MUTED,
    maxLines: 2,
  }) - 1;

  if (application.email) {
    memberY = drawParagraph(application.email, {
      x: left,
      y: memberY,
      width: 260,
      size: 9,
      lineHeight: 12,
      color: MUTED,
      maxLines: 1,
    }) - 1;
  }

  if (application.phone) {
    memberY = drawParagraph(application.phone, {
      x: left,
      y: memberY,
      width: 260,
      size: 9,
      lineHeight: 12,
      color: MUTED,
      maxLines: 1,
    }) - 1;
  }

  const summaryRows: { label: string; value: string }[] = [
    { label: "Date du paiement", value: paidAtLabel },
    { label: "Mode de paiement", value: paymentMethodLabel(application.paymentMethod) },
    { label: "Saison", value: MEMBERSHIP_SEASON_LABEL },
  ];
  if (application.licenseEndDate) {
    summaryRows.push({
      label: "Licence valable jusqu'au",
      value: formatDateFr(`${application.licenseEndDate}T12:00:00`),
    });
  }

  const summaryWidth = 205;
  const summaryX = right - summaryWidth;
  const summaryRowHeight = 31;
  const summaryHeight = summaryRows.length * summaryRowHeight + 14;
  page.drawRectangle({
    x: summaryX,
    y: metaTop - summaryHeight,
    width: summaryWidth,
    height: summaryHeight,
    borderColor: LINE,
    borderWidth: 0.8,
  });

  let summaryY = metaTop - 8;
  for (const row of summaryRows) {
    draw(row.label.toUpperCase(), summaryX + 10, summaryY, {
      bold: true,
      size: 6.5,
      color: MUTED,
    });
    summaryY -= 11;
    const lines = limitLines(wrapText(row.value, fontBold, 8.5, summaryWidth - 20), 1);
    draw(lines[0] ?? "-", summaryX + 10, summaryY, { bold: true, size: 8.5 });
    summaryY -= summaryRowHeight - 11;
  }

  y = Math.min(memberY, metaTop - summaryHeight) - 22;

  y = drawParagraph(
    "L'association certifie avoir encaissé le paiement de l'adhésion et des activités détaillées ci-dessous.",
    {
      x: left,
      y,
      width: CONTENT_WIDTH,
      size: 10,
      lineHeight: 14,
      maxLines: 2,
    },
  ) - 20;

  /* --------------------------------- Détail ---------------------------------- */

  const tableTop = y;
  page.drawLine({
    start: { x: left, y: tableTop },
    end: { x: right, y: tableTop },
    thickness: 1,
    color: ACCENT,
  });

  draw("DÉSIGNATION", left, tableTop - 14, { bold: true, size: 7, color: MUTED });
  drawRight("MONTANT", tableTop - 14, { bold: true, size: 7, color: MUTED });
  page.drawLine({
    start: { x: left, y: tableTop - 20 },
    end: { x: right, y: tableTop - 20 },
    thickness: 0.6,
    color: LINE,
  });

  const labelWidth = CONTENT_WIDTH - 130;
  let rowY = tableTop - 20;

  const rows: { label: string; note?: string; amount: string }[] = [];
  if (bulletin) {
    rows.push({
      label: "Cotisation annuelle obligatoire",
      amount: formatEuro(MEMBERSHIP_ADHESION_FEE),
    });
    rows.push({
      label: "Participation aux activités",
      note: activities.join(" · "),
      amount: formatEuro(bulletin.activitiesTotal),
    });
  } else {
    rows.push({
      label:
        activities.length > 1
          ? "Adhésion et participation aux activités"
          : "Adhésion et participation à l'activité",
      note: activities.join(" · "),
      amount: paidAmount !== null ? formatEuro(paidAmount) : fallbackAmount,
    });
  }

  for (const row of rows) {
    const labelLines = limitLines(wrapText(row.label, font, 9.5, labelWidth), 2);
    const noteLines = row.note
      ? limitLines(wrapText(row.note, font, 8, labelWidth), 2)
      : [];
    const contentHeight =
      labelLines.length * 12 + (noteLines.length > 0 ? noteLines.length * 10 + 3 : 0);
    const rowHeight = Math.max(28, contentHeight + 14);

    labelLines.forEach((line, index) => {
      draw(line, left, rowY - 12 - index * 12, { size: 9.5 });
    });
    noteLines.forEach((line, index) => {
      draw(line, left, rowY - 12 - labelLines.length * 12 - 3 - index * 10, {
        size: 8,
        color: MUTED,
      });
    });
    drawRight(row.amount, rowY - 12, { bold: true, size: 9.5 });

    rowY -= rowHeight;
    page.drawLine({
      start: { x: left, y: rowY },
      end: { x: right, y: rowY },
      thickness: 0.6,
      color: LINE,
    });
  }

  const totalDue = bulletin ? bulletin.grandTotal : paidAmount;
  const totalLabel = bulletin ? "TOTAL DU BULLETIN" : "MONTANT RÉGLÉ";
  const totalValue =
    totalDue !== null ? formatEuro(totalDue) : paidAmount !== null ? formatEuro(paidAmount) : fallbackAmount;

  const totalBlockTop = rowY - 18;
  drawRight(totalLabel, totalBlockTop, { bold: true, size: 7, color: MUTED });
  drawRight(totalValue, totalBlockTop - 18, { bold: true, size: 16, color: ACCENT });

  let afterTotal = totalBlockTop - 30;

  if (
    bulletin &&
    paidAmount !== null &&
    Math.abs(paidAmount - bulletin.grandTotal) > 0.001
  ) {
    drawRight(`Montant encaissé : ${formatEuro(paidAmount)}`, afterTotal, {
      bold: true,
      size: 9,
    });
    afterTotal -= 14;
  }

  y = afterTotal - 18;

  /* ------------------------------- Mentions ---------------------------------- */

  y = drawParagraph(
    "La présente attestation est délivrée à l'adhérent pour faire valoir ses droits auprès de son employeur, de sa mutuelle ou de tout organisme de remboursement.",
    {
      x: left,
      y,
      width: CONTENT_WIDTH,
      size: 8.5,
      lineHeight: 11.5,
      color: MUTED,
      maxLines: 3,
    },
  ) - 8;

  y = drawParagraph(
    "Cette attestation ne constitue pas une facture. Conservez ce document pour vos dossiers.",
    {
      x: left,
      y,
      width: CONTENT_WIDTH,
      size: 7.5,
      lineHeight: 10,
      color: MUTED,
      maxLines: 2,
    },
  );

  /* --------------------------- Signature et cachet --------------------------- */

  const signatureTop = 252;
  const presidentLabelY = Math.min(signatureTop, Math.max(230, y - 30));

  draw("LE PRÉSIDENT", left, presidentLabelY, { bold: true, size: 7, color: MUTED });

  const signature = association.signatureImageUrl
    ? await embedStoredImage(pdfDoc, association.signatureImageUrl)
    : null;
  if (signature) {
    const scaled = signature.scaleToFit(140, 48);
    page.drawImage(signature, {
      x: left,
      y: presidentLabelY - 12 - scaled.height,
      width: scaled.width,
      height: scaled.height,
    });
  }

  page.drawLine({
    start: { x: left, y: presidentLabelY - 64 },
    end: { x: left + 160, y: presidentLabelY - 64 },
    thickness: 0.7,
    color: LINE,
  });

  const president = presidentName(siteData);
  if (president) {
    draw(president, left, presidentLabelY - 76, { bold: true, size: 8.5 });
  }

  const stamp = association.stampImageUrl
    ? await embedStoredImage(pdfDoc, association.stampImageUrl)
    : null;
  if (stamp) {
    const scaled = stamp.scaleToFit(120, 100);
    page.drawImage(stamp, {
      x: right - scaled.width,
      y: presidentLabelY - 70,
      width: scaled.width,
      height: scaled.height,
    });
  }

  /* ---------------------------------- Pied ----------------------------------- */

  page.drawLine({
    start: { x: left, y: 64 },
    end: { x: right, y: 64 },
    thickness: 0.6,
    color: LINE,
  });

  const footerParts = [
    association.name || "Association",
    association.contactEmail,
    association.siret?.trim() ? `SIRET ${association.siret.trim()}` : "",
    association.rna?.trim() ? `RNA ${association.rna.trim()}` : "",
  ].filter((value): value is string => Boolean(value && value.trim()));

  drawParagraph(footerParts.join("  ·  "), {
    x: left,
    y: 50,
    width: CONTENT_WIDTH,
    size: 7.5,
    lineHeight: 9,
    color: MUTED,
    maxLines: 1,
  });

  drawRight("Document généré automatiquement par l'espace bureau.", 38, {
    size: 7,
    color: MUTED,
  });

  return pdfDoc.save();
}
