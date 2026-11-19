import { after } from "next/server";
import { appBaseUrl as sharedAppBaseUrl } from "@/lib/app-url";
import { ASSOCIATION_PHONE_DISPLAY } from "@/lib/association-contact";
import { updateClubData } from "@/lib/club-data";
import type { LifecycleEmailKind, RegistrationApplication } from "@/lib/club-data";
import { escapeHtml } from "@/lib/email-html";
import { sendEmail } from "@/lib/mailer";
import { MEMBERSHIP_ADHESION_FEE, paymentPlanLabel } from "@/lib/membership-bulletin";
import { readSiteData } from "@/lib/site-data";
import type { AssociationData } from "@/lib/site-data-types";

export type { LifecycleEmailKind };

const BRAND_BLUE = "#1f6fd0";
const BRAND_GREEN = "#2e9e4f";
const BRAND_CREAM = "#fbf8f3";
const INK = "#1b2733";
const MUTED = "#5b6773";

/** Ordre du chèque : nom exact de l'association (celui qui figure sur son compte bancaire). */
export const CHECK_PAYEE = "Activ Sainte-Croix Sport et Culture";

/* ------------------------------------------------------------------ */
/* Liens et coordonnées                                                */
/* ------------------------------------------------------------------ */

/** Adresse publique du site (voir src/lib/app-url.ts). */
export function appBaseUrl(): string | null {
  return sharedAppBaseUrl();
}

export function appLink(path: string): string | null {
  const base = appBaseUrl();
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : null;
}

type AssociationContact = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export function associationContact(siteData: AssociationData): AssociationContact {
  const association = siteData.association;
  return {
    name: association.name?.trim() || "l’association",
    email: association.contactEmail?.trim() || "",
    phone: ASSOCIATION_PHONE_DISPLAY,
    address: [association.address, association.city].filter((part) => part?.trim()).join(", "),
  };
}

export function memberGreetingName(
  application: Pick<RegistrationApplication, "firstName" | "fullName">,
): string {
  return application.firstName?.trim() || application.fullName?.trim() || "adhérent(e)";
}

export function formatEuroAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

/* ------------------------------------------------------------------ */
/* Gabarit commun                                                      */
/* ------------------------------------------------------------------ */

export type EmailContent = { subject: string; html: string; text: string };

export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${INK}">${html}</p>`;
}

export function emphasis(value: string): string {
  return `<strong>${escapeHtml(value)}</strong>`;
}

export function button(label: string, href: string, color = BRAND_BLUE): string {
  return `<p style="margin:20px 0"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;background:${color};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:16px">${escapeHtml(label)}</a></p>`;
}

export function infoBox(title: string, lines: string[], accent = BRAND_GREEN): string {
  const items = lines
    .map((line) => `<li style="margin:0 0 6px">${line}</li>`)
    .join("");
  return `<div style="margin:18px 0;padding:14px 18px;background:${BRAND_CREAM};border-left:4px solid ${accent};border-radius:8px"><p style="margin:0 0 8px;font-weight:700;color:${INK}">${escapeHtml(title)}</p><ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.5;color:${INK}">${items}</ul></div>`;
}

function contactHtml(contact: AssociationContact): string {
  const parts = [
    contact.email
      ? `<a href="mailto:${escapeHtml(contact.email)}" style="color:${BRAND_BLUE}">${escapeHtml(contact.email)}</a>`
      : "",
    contact.phone ? escapeHtml(contact.phone) : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function contactText(contact: AssociationContact): string {
  return [contact.email, contact.phone].filter(Boolean).join(" · ");
}

/** Enveloppe HTML : bandeau bleu, carte blanche sur fond crème, pied avec les coordonnées. */
export function renderEmailShell(params: {
  contact: AssociationContact;
  heading: string;
  bodyHtml: string;
}): string {
  const { contact, heading, bodyHtml } = params;
  const contactLine = contactHtml(contact);
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px 12px;background:${BRAND_CREAM};font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e1d6">
<div style="background:${BRAND_BLUE};padding:16px 24px;color:#ffffff;font-size:18px;font-weight:700">${escapeHtml(contact.name)}</div>
<div style="padding:24px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND_BLUE}">${escapeHtml(heading)}</h1>
${bodyHtml}
<p style="margin:18px 0 0;font-size:16px;color:${INK}">Sportivement,<br/>${escapeHtml(contact.name)}</p>
</div>
<div style="padding:14px 24px;background:${BRAND_CREAM};font-size:13px;line-height:1.5;color:${MUTED}">
${contactLine ? `Une question ? ${contactLine}` : ""}
</div>
</div></body></html>`;
}

function subjectFor(contact: AssociationContact, title: string): string {
  return `[${contact.name}] ${title}`;
}

function contactFooterText(contact: AssociationContact): string {
  const line = contactText(contact);
  return line ? `\nUne question ? ${line}` : "";
}

/* ------------------------------------------------------------------ */
/* Contenus                                                            */
/* ------------------------------------------------------------------ */

export function buildEspaceActivatedEmail(params: {
  application: Pick<RegistrationApplication, "firstName" | "fullName">;
  siteData: AssociationData;
}): EmailContent {
  const contact = associationContact(params.siteData);
  const name = memberGreetingName(params.application);
  const signInUrl = appLink("/sign-in");
  const title = "Votre espace adhérent est activé";

  const body = [
    paragraph(`Bonjour ${escapeHtml(name)},`),
    paragraph(
      "Bonne nouvelle : le bureau a validé votre demande et <strong>votre espace adhérent est activé</strong>. Vous pouvez dès maintenant vous connecter avec votre adresse e-mail et le mot de passe choisi lors de votre inscription.",
    ),
    signInUrl ? button("Me connecter", signInUrl) : "",
    infoBox("Et ensuite ?", [
      "Le bureau vérifie vos pièces. S’il lui manque un document, vous recevrez un e-mail avec un lien sécurisé pour le déposer.",
      "Une fois vos pièces conformes, vous recevrez les modalités de paiement de votre cotisation.",
      "Votre inscription sera finalisée à la réception de votre règlement.",
    ]),
  ].join("\n");

  const text = [
    `Bonjour ${name},`,
    "",
    "Bonne nouvelle : le bureau a validé votre demande et votre espace adhérent est activé. Vous pouvez dès maintenant vous connecter avec votre adresse e-mail et le mot de passe choisi lors de votre inscription.",
    signInUrl ? `\nConnexion : ${signInUrl}` : "",
    "",
    "Et ensuite ?",
    "- Le bureau vérifie vos pièces. S’il lui manque un document, vous recevrez un e-mail avec un lien sécurisé pour le déposer.",
    "- Une fois vos pièces conformes, vous recevrez les modalités de paiement de votre cotisation.",
    "- Votre inscription sera finalisée à la réception de votre règlement.",
    "",
    "Sportivement,",
    contact.name,
    contactFooterText(contact),
  ].join("\n");

  return {
    subject: subjectFor(contact, title),
    html: renderEmailShell({ contact, heading: title, bodyHtml: body }),
    text,
  };
}

export function buildPaymentExpectedEmail(params: {
  application: Pick<
    RegistrationApplication,
    "firstName" | "fullName" | "membershipBulletin" | "amountPaid"
  >;
  siteData: AssociationData;
}): EmailContent {
  const { application } = params;
  const contact = associationContact(params.siteData);
  const name = memberGreetingName(application);
  const bulletin = application.membershipBulletin;
  const title = "Paiement attendu";

  const total = bulletin && bulletin.grandTotal > 0 ? bulletin.grandTotal : null;
  const amountLine = total
    ? `Montant à régler : ${formatEuroAmount(total)} (cotisation annuelle ${formatEuroAmount(MEMBERSHIP_ADHESION_FEE)} + activités ${formatEuroAmount(bulletin?.activitiesTotal ?? 0)}).`
    : "Le montant à régler est celui indiqué sur votre bulletin d’adhésion.";
  const planLine = bulletin?.paymentPlan ? paymentPlanLabel(bulletin.paymentPlan) : "";

  const howLines = [
    `par chèque, à l’ordre de « ${CHECK_PAYEE} »`,
    "en espèces",
    "par virement : demandez-nous les coordonnées bancaires par retour de message",
  ];
  const whereLine = contact.address
    ? `Remettez votre règlement au bureau de l’association (${contact.address}) ou convenez d’un rendez-vous avec nous.`
    : "Remettez votre règlement au bureau de l’association ou convenez d’un rendez-vous avec nous.";

  const body = [
    paragraph(`Bonjour ${escapeHtml(name)},`),
    paragraph(
      "Vos pièces sont conformes, merci ! <strong>Il ne reste plus qu’à régler votre cotisation</strong> pour finaliser votre inscription.",
    ),
    infoBox(
      "Votre règlement",
      [escapeHtml(amountLine), ...(planLine ? [escapeHtml(planLine)] : [])],
      BRAND_BLUE,
    ),
    infoBox("Comment payer ?", howLines.map((line) => escapeHtml(line))),
    paragraph(escapeHtml(whereLine)),
    paragraph(
      "Dès réception, votre inscription sera finalisée et vous recevrez une attestation de paiement par e-mail.",
    ),
  ].join("\n");

  const text = [
    `Bonjour ${name},`,
    "",
    "Vos pièces sont conformes, merci ! Il ne reste plus qu’à régler votre cotisation pour finaliser votre inscription.",
    "",
    amountLine,
    planLine,
    "",
    "Comment payer ?",
    ...howLines.map((line) => `- ${line}`),
    "",
    whereLine,
    "",
    "Dès réception, votre inscription sera finalisée et vous recevrez une attestation de paiement par e-mail.",
    "",
    "Sportivement,",
    contact.name,
    contactFooterText(contact),
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");

  return {
    subject: subjectFor(contact, title),
    html: renderEmailShell({ contact, heading: title, bodyHtml: body }),
    text,
  };
}

export function buildApplicationRejectedEmail(params: {
  application: Pick<RegistrationApplication, "firstName" | "fullName">;
  reason: string;
  siteData: AssociationData;
}): EmailContent {
  const contact = associationContact(params.siteData);
  const name = memberGreetingName(params.application);
  const reason = params.reason.trim();
  const title = "Votre dossier n’a pas pu être accepté";

  const body = [
    paragraph(`Bonjour ${escapeHtml(name)},`),
    paragraph(
      "Après examen, <strong>nous ne sommes malheureusement pas en mesure d’accepter votre dossier d’inscription</strong>. Votre accès à l’espace adhérent a été fermé.",
    ),
    reason ? infoBox("Motif indiqué par le bureau", [escapeHtml(reason)], BRAND_BLUE) : "",
    paragraph(
      "Si vous pensez qu’il s’agit d’une erreur ou si vous souhaitez en discuter, n’hésitez pas à nous contacter : nous vous répondrons avec plaisir.",
    ),
  ].join("\n");

  const text = [
    `Bonjour ${name},`,
    "",
    "Après examen, nous ne sommes malheureusement pas en mesure d’accepter votre dossier d’inscription. Votre accès à l’espace adhérent a été fermé.",
    reason ? `\nMotif indiqué par le bureau : ${reason}` : "",
    "",
    "Si vous pensez qu’il s’agit d’une erreur ou si vous souhaitez en discuter, n’hésitez pas à nous contacter.",
    "",
    "Sportivement,",
    contact.name,
    contactFooterText(contact),
  ].join("\n");

  return {
    subject: subjectFor(contact, title),
    html: renderEmailShell({ contact, heading: title, bodyHtml: body }),
    text,
  };
}

export function buildCancellationEmail(params: {
  application: Pick<RegistrationApplication, "firstName" | "fullName">;
  siteData: AssociationData;
}): EmailContent {
  const contact = associationContact(params.siteData);
  const name = memberGreetingName(params.application);
  const title = "Désinscription enregistrée";
  const signInUrl = appLink("/sign-in");

  const body = [
    paragraph(`Bonjour ${escapeHtml(name)},`),
    paragraph(
      "Nous avons bien enregistré votre <strong>désinscription</strong> : vous ne recevrez plus les messages du club et vos accès à l’espace adhérent sont fermés.",
    ),
    paragraph(
      "Vous souhaitez reprendre une activité ? Connectez-vous avec votre adresse e-mail habituelle pour déposer une nouvelle pré-inscription, ou contactez-nous.",
    ),
    signInUrl ? button("Me connecter", signInUrl, BRAND_GREEN) : "",
  ].join("\n");

  const text = [
    `Bonjour ${name},`,
    "",
    "Nous avons bien enregistré votre désinscription : vous ne recevrez plus les messages du club et vos accès à l’espace adhérent sont fermés.",
    "",
    "Vous souhaitez reprendre une activité ? Connectez-vous avec votre adresse e-mail habituelle pour déposer une nouvelle pré-inscription, ou contactez-nous.",
    signInUrl ? `\nConnexion : ${signInUrl}` : "",
    "",
    "Sportivement,",
    contact.name,
    contactFooterText(contact),
  ].join("\n");

  return {
    subject: subjectFor(contact, title),
    html: renderEmailShell({ contact, heading: title, bodyHtml: body }),
    text,
  };
}

/* ------------------------------------------------------------------ */
/* Envoi (une seule fois par étape)                                    */
/* ------------------------------------------------------------------ */

/**
 * À appeler DANS `updateClubData`, sur la transition réelle : réserve l'envoi (retourne `true`
 * si le message doit partir) et note la date pour qu'aucun doublon ne soit jamais envoyé.
 */
export function claimLifecycleEmail(
  application: RegistrationApplication,
  kind: LifecycleEmailKind,
  now: Date = new Date(),
): boolean {
  if (!application.email?.trim()) return false;
  if (application.lifecycleNotified?.[kind]) return false;
  application.lifecycleNotified = { ...application.lifecycleNotified, [kind]: now.toISOString() };
  return true;
}

async function releaseLifecycleClaim(applicationId: string, kind: LifecycleEmailKind): Promise<void> {
  try {
    await updateClubData((data) => {
      const application = data.applications.find((entry) => entry.id === applicationId);
      if (application?.lifecycleNotified?.[kind]) {
        const remaining = { ...application.lifecycleNotified };
        delete remaining[kind];
        application.lifecycleNotified = remaining;
      }
    });
  } catch (error) {
    console.error("releaseLifecycleClaim failed", { applicationId, kind, error });
  }
}

/** Exécute `task` après l'envoi de la réponse (hors contexte de requête : en tâche détachée). */
export function runInBackground(label: string, task: () => Promise<unknown>): void {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`${label} failed`, error);
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

async function buildLifecycleEmail(
  kind: Exclude<LifecycleEmailKind, "finalized">,
  application: RegistrationApplication,
): Promise<EmailContent> {
  const siteData = await readSiteData();
  switch (kind) {
    case "espace_activated":
      return buildEspaceActivatedEmail({ application, siteData });
    case "payment_expected":
      return buildPaymentExpectedEmail({ application, siteData });
    case "rejected":
      return buildApplicationRejectedEmail({
        application,
        reason: application.rejectionReason ?? "",
        siteData,
      });
    case "cancelled":
      return buildCancellationEmail({ application, siteData });
  }
}

/**
 * Envoie un e-mail de suivi sans bloquer la réponse. `application` est une copie prise au moment
 * de la transition. En cas d'échec d'envoi la réservation est levée : refaire l'étape renverra le message.
 */
export function queueLifecycleEmail(
  kind: Exclude<LifecycleEmailKind, "finalized">,
  application: RegistrationApplication,
): void {
  const to = application.email?.trim();
  if (!to) return;
  runInBackground(`lifecycle e-mail ${kind}`, async () => {
    try {
      const content = await buildLifecycleEmail(kind, application);
      const result = await sendEmail({ to, ...content });
      if (!result.sent) {
        console.error("Lifecycle e-mail not sent", { kind, applicationId: application.id, reason: result.reason });
        await releaseLifecycleClaim(application.id, kind);
      }
    } catch (error) {
      console.error("Lifecycle e-mail failed", { kind, applicationId: application.id, error });
      await releaseLifecycleClaim(application.id, kind);
    }
  });
}
