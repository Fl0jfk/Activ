import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { MembershipBulletinFormPayload } from "@/lib/membership-bulletin";
import {
  MEMBERSHIP_ADHESION_FEE,
  MEMBERSHIP_ACTIVITY_SLOTS,
  MEMBERSHIP_SEASON_LABEL,
  computeMembershipTotals,
  imageRightsLabel,
  paymentPlanLabel,
} from "@/lib/membership-bulletin";

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
  return lines.length > 0 ? lines : [""];
}

async function embedSignature(pdfDoc: PDFDocument, dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Signature image invalide.");
  }
  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  if (mime.includes("png")) {
    return pdfDoc.embedPng(bytes);
  }
  return pdfDoc.embedJpg(bytes);
}

export async function buildMembershipBulletinPdf(
  payload: MembershipBulletinFormPayload,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  let y = 800;
  const maxWidthChars = 92;

  const draw = (text: string, options?: { bold?: boolean; size?: number; gap?: number }) => {
    const size = options?.size ?? 9;
    const usedFont = options?.bold ? fontBold : font;
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: usedFont,
      color: rgb(0.1, 0.12, 0.16),
    });
    y -= options?.gap ?? size + 4;
  };

  const drawWrapped = (text: string, options?: { bold?: boolean; size?: number }) => {
    const size = options?.size ?? 8.5;
    for (const line of wrapText(text, maxWidthChars)) {
      draw(line, { bold: options?.bold, size, gap: size + 3 });
    }
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
  for (const slot of MEMBERSHIP_ACTIVITY_SLOTS) {
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
  const sigWidth = 180;
  const sigHeight = (signature.height / signature.width) * sigWidth;
  if (y - sigHeight < 40) {
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    page2.drawText("Signature de l'adhérent(e) :", {
      x: margin,
      y: 800,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.12, 0.16),
    });
    page2.drawImage(signature, {
      x: margin,
      y: 800 - 14 - sigHeight,
      width: sigWidth,
      height: sigHeight,
    });
  } else {
    page.drawImage(signature, {
      x: margin,
      y: y - sigHeight,
      width: sigWidth,
      height: sigHeight,
    });
  }

  return pdfDoc.save();
}
