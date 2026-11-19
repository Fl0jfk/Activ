import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import { EMAIL_COLORS, emailLayout, escapeHtml, safeHref } from "@/lib/email-html";
import {
  MEMBERSHIP_ADHESION_FEE,
  MEMBERSHIP_SEASON_LABEL,
  paymentPlanLabel,
  type MembershipPaymentPlan,
} from "@/lib/membership-bulletin";

type AcknowledgmentParams = {
  firstName: string;
  /** Activités choisies (bulletin) ou discipline de la séance d'essai. */
  activityLabels: string[];
  /** Séance d'essai réservée, le cas échéant. */
  trial?: { title: string; whenLabel: string };
  /** Montants et modalité de paiement (bulletin d'adhésion). */
  payment?: { activitiesTotal: number; grandTotal: number; plan: MembershipPaymentPlan };
  hasPdfCopy: boolean;
  signInUrl: string;
  contactEmail: string;
};

function euros(amount: number): string {
  return `${amount} €`;
}

/** E-mail de confirmation envoyé à la personne qui vient de s'inscrire. */
export function buildApplicantAcknowledgmentEmail(params: AcknowledgmentParams) {
  const { firstName, activityLabels, trial, payment, hasPdfCopy, signInUrl, contactEmail } = params;
  const greeting = firstName.trim() ? `Bonjour ${firstName.trim()},` : "Bonjour,";
  const isTrialOnly = Boolean(trial) && !payment;

  const subject = isTrialOnly
    ? "[Activ'] Votre demande de séance d'essai est bien enregistrée"
    : "[Activ'] Nous avons bien reçu votre bulletin d'adhésion";
  const intro = isTrialOnly
    ? "Merci ! Votre demande de séance d'essai est bien enregistrée et votre compte est créé."
    : `Merci ! Nous avons bien reçu votre bulletin d'adhésion pour la ${MEMBERSHIP_SEASON_LABEL.replace("Saison", "saison")} et votre compte est créé.`;

  const paymentLine = payment
    ? `Total à régler : ${euros(payment.grandTotal)} (adhésion ${euros(MEMBERSHIP_ADHESION_FEE)} + activités ${euros(payment.activitiesTotal)})`
    : null;
  const planLine = payment ? `Modalité de paiement : ${paymentPlanLabel(payment.plan)}` : null;
  const trialLine = trial ? `Séance d'essai : ${trial.title} — ${trial.whenLabel}` : null;

  const steps = [
    isTrialOnly ? "Le bureau examine votre demande." : "Le bureau examine votre dossier.",
    "Vous recevrez un e-mail dès que votre espace adhérent est activé.",
    `Vous pourrez alors vous connecter avec l’e-mail et le mot de passe choisis lors de votre inscription : ${signInUrl}`,
    `Une question ? Appelez-nous au ${ASSOCIATION_PHONE_DISPLAY}${contactEmail ? ` ou écrivez-nous à ${contactEmail}` : ""}.`,
  ];

  const text = [
    greeting,
    "",
    intro,
    "",
    "Votre récapitulatif",
    ...(activityLabels.length > 0 ? ["Activités choisies :", ...activityLabels.map((label) => `  - ${label}`)] : []),
    ...(trialLine ? [trialLine] : []),
    ...(paymentLine ? [paymentLine] : []),
    ...(planLine ? [planLine] : []),
    "",
    ...(hasPdfCopy ? ["Vous trouverez en pièce jointe la copie signée de votre bulletin.", ""] : []),
    "Et maintenant ?",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Sportivement,",
    "L'équipe Activ'",
  ].join("\n");

  const summaryRows = [
    activityLabels.length > 0
      ? `<p style="margin:0 0 6px"><strong>Activités choisies</strong></p><ul style="margin:0 0 12px;padding-left:20px">${activityLabels
          .map((label) => `<li>${escapeHtml(label)}</li>`)
          .join("")}</ul>`
      : "",
    trialLine ? `<p style="margin:0 0 8px"><strong>Séance d'essai&nbsp;:</strong> ${escapeHtml(`${trial!.title} — ${trial!.whenLabel}`)}</p>` : "",
    paymentLine
      ? `<p style="margin:0 0 8px"><strong>Total à régler&nbsp;:</strong> <span style="color:${EMAIL_COLORS.greenDark};font-weight:700">${escapeHtml(euros(payment!.grandTotal))}</span> <span style="color:${EMAIL_COLORS.muted}">(adhésion ${escapeHtml(euros(MEMBERSHIP_ADHESION_FEE))} + activités ${escapeHtml(euros(payment!.activitiesTotal))})</span></p>`
      : "",
    planLine ? `<p style="margin:0"><strong>Modalité de paiement&nbsp;:</strong> ${escapeHtml(paymentPlanLabel(payment!.plan))}</p>` : "",
  ].join("");

  const contactHtml = `Une question&nbsp;? Appelez-nous au <a href="${escapeHtml(ASSOCIATION_PHONE_TEL)}" style="color:${EMAIL_COLORS.blue}">${escapeHtml(ASSOCIATION_PHONE_DISPLAY)}</a>${
    contactEmail
      ? ` ou écrivez-nous à <a href="mailto:${escapeHtml(contactEmail)}" style="color:${EMAIL_COLORS.blue}">${escapeHtml(contactEmail)}</a>`
      : ""
  }.`;

  const stepsHtml = `<ol style="margin:0;padding-left:22px">
<li style="margin-bottom:6px">${escapeHtml(steps[0]!)}</li>
<li style="margin-bottom:6px">${escapeHtml(steps[1]!)}</li>
<li style="margin-bottom:6px">Vous pourrez alors vous connecter avec l’e-mail et le mot de passe choisis lors de votre inscription&nbsp;: <a href="${safeHref(signInUrl)}" style="color:${EMAIL_COLORS.blue};font-weight:700">se connecter</a>.</li>
<li>${contactHtml}</li>
</ol>`;

  const bodyHtml = `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px">${escapeHtml(intro)}</p>
<div style="background:${EMAIL_COLORS.cream};border:1px solid ${EMAIL_COLORS.line};border-radius:12px;padding:14px 16px;margin:0 0 16px">
<p style="margin:0 0 10px;color:${EMAIL_COLORS.blueDark};font-weight:700">Votre récapitulatif</p>
${summaryRows}
</div>
${hasPdfCopy ? `<p style="margin:0 0 16px">Vous trouverez en pièce jointe la <strong>copie signée de votre bulletin</strong>.</p>` : ""}
<h2 style="margin:20px 0 8px;font-size:17px;color:${EMAIL_COLORS.greenDark}">Et maintenant&nbsp;?</h2>
${stepsHtml}
<p style="margin:16px 0 0">Sportivement,<br/>L'équipe Activ'</p>`;

  const html = emailLayout({
    title: isTrialOnly ? "Votre demande est enregistrée" : "Votre bulletin est bien reçu",
    bodyHtml,
  });

  return { subject, text, html };
}

/** E-mail contenant le code de vérification (6 chiffres) de l'adresse. */
export function buildVerificationCodeEmail(params: { code: string; ttlMinutes: number }) {
  const { code, ttlMinutes } = params;
  const subject = "[Activ'] Votre code de vérification";
  const text = `Bonjour,

Voici votre code de vérification : ${code}

Il est valable ${ttlMinutes} minutes et ne peut être utilisé qu'une seule fois.
Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.

Sportivement,
L'équipe Activ'`;
  const html = emailLayout({
    title: "Votre code de vérification",
    bodyHtml: `<p style="margin:0 0 12px">Bonjour,</p>
<p style="margin:0 0 8px">Saisissez ce code dans le formulaire d'inscription&nbsp;:</p>
<p style="margin:12px 0;padding:14px 0;text-align:center;background:${EMAIL_COLORS.cream};border:1px solid ${EMAIL_COLORS.line};border-radius:12px;font-size:32px;font-weight:700;letter-spacing:8px;color:${EMAIL_COLORS.blueDark}">${escapeHtml(code)}</p>
<p style="margin:0 0 12px">Il est valable ${ttlMinutes} minutes et ne peut être utilisé qu'une seule fois.</p>
<p style="margin:0 0 12px;color:${EMAIL_COLORS.muted}">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.</p>
<p style="margin:16px 0 0">Sportivement,<br/>L'équipe Activ'</p>`,
  });
  return { subject, text, html };
}

/** E-mail envoyé après la revalidation d'un bulletin (copie signée en pièce jointe). */
export function buildBulletinRevalidatedEmail(params: { firstName: string }) {
  const greeting = params.firstName.trim() ? `Bonjour ${params.firstName.trim()},` : "Bonjour,";
  const subject = "[Activ'] Votre bulletin d'adhésion est revalidé";
  const text = `${greeting}

Votre bulletin d'adhésion a bien été revalidé. Vous trouverez votre copie signée en pièce jointe.
Le bureau poursuit le traitement de votre dossier.

Sportivement,
L'équipe Activ'`;
  const html = emailLayout({
    title: "Votre bulletin est revalidé",
    bodyHtml: `<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 12px">Votre bulletin d'adhésion a bien été <strong>revalidé</strong>. Vous trouverez votre copie signée en pièce jointe.</p>
<p style="margin:0 0 12px">Le bureau poursuit le traitement de votre dossier.</p>
<p style="margin:16px 0 0">Sportivement,<br/>L'équipe Activ'</p>`,
  });
  return { subject, text, html };
}

