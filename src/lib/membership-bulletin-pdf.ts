import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { MembershipBulletinFormPayload } from "@/lib/membership-bulletin";
import {
  MEMBERSHIP_ADHESION_FEE,
  MEMBERSHIP_ACTIVITY_SLOTS,
  MEMBERSHIP_SEASON_LABEL,
  computeMembershipTotals,
  imageRightsLabel,
  paymentPlanLabel,
} from "@/lib/membership-bulletin";

/** Erreur dont le message peut être montré tel quel à la personne qui remplit le bulletin. */
export class BulletinPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulletinPdfError";
  }
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const TOP = 800;
const BOTTOM = 50;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Les polices standard du PDF ne savent écrire que le jeu WinAnsi : tout autre caractère ferait échouer
 * la génération. On conserve les lettres accentuées usuelles, on retire les accents des autres lettres
 * quand c'est possible et on remplace le reste par « ? ».
 */
function makePdfText(font: PDFFont): (text: string) => string {
  const supported = new Set(font.getCharacterSet());
  return (text) => {
    let out = "";
    for (const char of text.normalize("NFC")) {
      const codePoint = char.codePointAt(0) ?? 0;
      if (/\s/u.test(char)) {
        out += " ";
      } else if (supported.has(codePoint)) {
        out += char;
      } else {
        const base = char.normalize("NFD").charAt(0);
        out += base && supported.has(base.codePointAt(0) ?? 0) ? base : "?";
      }
    }
    return out;
  };
}

async function embedSignature(pdfDoc: PDFDocument, dataUrl: string): Promise<PDFImage> {
  const match = /^data:(image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!match) {
    throw new BulletinPdfError("Signature manquante ou invalide. Signez à nouveau dans l'encadré.");
  }
  const bytes = Buffer.from(match[2]!, "base64");
  try {
    return match[1]!.toLowerCase().includes("png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
  } catch {
    throw new BulletinPdfError("Signature manquante ou invalide. Signez à nouveau dans l'encadré.");
  }
}

type PdfActivityOption = {
  id: string;
  day: string;
  time: string;
  activity: string;
};

export async function buildMembershipBulletinPdf(
  payload: MembershipBulletinFormPayload,
  options?: { activityOptions?: PdfActivityOption[] },
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("Bulletin d'adhésion");
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pdfText = makePdfText(font);
  const ink = rgb(0.1, 0.12, 0.16);

  let page: PDFPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = TOP;

  const startNewPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = TOP;
  };

  const wrap = (text: string, usedFont: PDFFont, size: number): string[] => {
    const lines: string[] = [];
    let current = "";
    const fits = (candidate: string) => usedFont.widthOfTextAtSize(candidate, size) <= TEXT_WIDTH;
    for (const word of text.split(" ").filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      let rest = word;
      while (!fits(rest)) {
        let cut = rest.length - 1;
        while (cut > 1 && !fits(rest.slice(0, cut))) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  };

  const draw = (text: string, drawOptions?: { bold?: boolean; size?: number; gap?: number }) => {
    const size = drawOptions?.size ?? 9;
    const usedFont = drawOptions?.bold ? fontBold : font;
    const lines = wrap(pdfText(text), usedFont, size);
    lines.forEach((line, index) => {
      if (y < BOTTOM + size) startNewPage();
      page.drawText(line, { x: MARGIN, y, size, font: usedFont, color: ink });
      y -= index === lines.length - 1 ? (drawOptions?.gap ?? size + 4) : size + 3;
    });
  };

  const drawWrapped = (text: string, drawOptions?: { bold?: boolean; size?: number }) => {
    const size = drawOptions?.size ?? 8.5;
    draw(text, { bold: drawOptions?.bold, size, gap: size + 3 });
  };

  const totals = computeMembershipTotals(payload.selectedSlots);
  const fullName = `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim();

  draw("Bulletin d'adhésion Activ' Sainte-Croix Sport et Culture", { bold: true, size: 13, gap: 16 });
  draw(MEMBERSHIP_SEASON_LABEL, { bold: true, size: 11, gap: 18 });

  draw("1. COORDONNÉES DE L'ADHÉRENT", { bold: true, size: 10, gap: 14 });
  draw(`Nom : ${payload.lastName.trim()}`);
  draw(`Prénom : ${payload.firstName.trim()}`);
  draw(`Date de naissance : ${payload.birthDate}`);
  draw(`Téléphone : ${payload.phone.trim()}`);
  draw(`Adresse : ${payload.address.trim()}`);
  draw(`Code postal : ${payload.postalCode.trim()}    Ville : ${payload.city.trim()}`);
  draw(`Adresse e-mail : ${payload.email.trim()}`);
  draw(
    `Contact urgence : ${payload.emergencyContactName.trim()} — ${payload.emergencyContactPhone.trim()}`,
    { gap: 16 },
  );

  draw("2. TARIFS ET MODALITÉS DE PAIEMENT", { bold: true, size: 10, gap: 14 });
  draw(`Adhésion obligatoire : ${MEMBERSHIP_ADHESION_FEE} €`);
  draw("1 activité : 180 €  |  2 activités : 260 €  |  3 activités : 320 €");
  draw(`Total activités : ${totals.activitiesTotal} €`);
  draw(`Total à régler : ${totals.grandTotal} €`, { bold: true });
  drawWrapped(paymentPlanLabel(payload.paymentPlan));
  y -= 6;

  draw("3. CHOIX DES ACTIVITÉS", { bold: true, size: 10, gap: 14 });
  const activityOptions =
    options?.activityOptions && options.activityOptions.length > 0
      ? options.activityOptions
      : MEMBERSHIP_ACTIVITY_SLOTS;
  for (const slot of activityOptions) {
    const checked = payload.selectedSlots.includes(slot.id) ? "[X]" : "[ ]";
    draw(`${checked}  ${slot.day}  ${slot.time}  ${slot.activity}`);
  }
  y -= 8;

  draw("4. ENGAGEMENTS, ASSURANCE ET AUTORISATIONS", { bold: true, size: 10, gap: 14 });
  drawWrapped(
    "Règlement intérieur : Je m'engage à respecter le règlement intérieur de l'association ainsi que les consignes de sécurité des locaux mis à disposition par la mairie de Sainte-Croix.",
  );
  drawWrapped(
    "Santé : Je certifie sur l'honneur être en condition physique suffisante pour pratiquer en toute sécurité les activités cochées. Je pratique sous ma propre responsabilité.",
  );
  drawWrapped(
    "Assurance : L'association m'a informé de mon intérêt à souscrire une assurance individuelle accidents corporels. Je reconnais que l'association ne fournit pas cette garantie.",
  );
  drawWrapped(`Droit à l'image : ${imageRightsLabel(payload.imageRights)}`);
  drawWrapped(
    "Protection des données : les informations sont destinées uniquement à l'association Activ' Sainte-Croix Sport et Culture (RGPD).",
  );
  y -= 6;

  draw("5. CONDITIONS DE REMBOURSEMENT", { bold: true, size: 10, gap: 14 });
  drawWrapped(
    "Les cotisations versées sont non remboursables, sauf cas de force majeure justifié. Toute demande doit être adressée par écrit au bureau.",
  );
  y -= 6;

  draw("6. VALIDATION ET SIGNATURE", { bold: true, size: 10, gap: 14 });
  drawWrapped(
    "Je certifie avoir pris connaissance de l'ensemble des informations et déclarations fournies sur ce bulletin.",
  );
  draw(`Fait à ${payload.signedPlace.trim() || "Sainte-Croix"}, le ${payload.signedAt}`);
  draw(`Adhérent(e) : ${fullName}`, { gap: 12 });
  draw("Signature :", { gap: 10 });

  const signature = await embedSignature(pdfDoc, payload.signatureDataUrl);
  const scale = Math.min(180 / signature.width, 120 / signature.height);
  const sigWidth = signature.width * scale;
  const sigHeight = signature.height * scale;
  if (y - sigHeight < 40) {
    startNewPage();
    page.drawText(pdfText("Signature de l'adhérent(e) :"), {
      x: MARGIN,
      y: TOP,
      size: 10,
      font: fontBold,
      color: ink,
    });
    y = TOP - 14;
  }
  page.drawImage(signature, {
    x: MARGIN,
    y: y - sigHeight,
    width: sigWidth,
    height: sigHeight,
  });

  return pdfDoc.save();
}
