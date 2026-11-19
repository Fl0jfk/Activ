"use client";

import { useEffect, useRef } from "react";
import { StatusMessage, type Feedback } from "@/components/bureau-ui";
import type { BroadcastFailure, BroadcastSendResponse } from "@/lib/broadcast-types";

export type BroadcastSendSummary = {
  response: BroadcastSendResponse;
  audienceLabel: string;
  subject: string;
  sentAt: string;
};

function failureLabel(reason: BroadcastFailure["reason"]): string {
  switch (reason) {
    case "mailbox_unavailable":
      return "Adresse introuvable ou boîte indisponible";
    case "invalid_address":
      return "Adresse refusée par le serveur";
    default:
      return "Envoi impossible";
  }
}

/** Conseils repliés : une seule page de dépannage, sans texte redondant. */
export function BroadcastDeliveryTips() {
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4">
      <summary className="flex min-h-12 cursor-pointer items-center text-sm font-bold text-brand-blue-dark">
        Conseils si les messages n’arrivent pas
      </summary>
      <ul className="list-disc space-y-2 pb-4 pl-5 text-sm leading-6 text-slate-700">
        <li>Demandez à la personne de regarder dans ses courriers indésirables (spams).</li>
        <li>
          Une adresse refusée est souvent une faute de frappe : corrigez-la dans la fiche de
          l’adhérent, puis écrivez-lui à lui seul.
        </li>
        <li>
          Les boîtes Hotmail ou Outlook inutilisées depuis longtemps sont parfois fermées :
          demandez une autre adresse.
        </li>
      </ul>
    </details>
  );
}

export default function BroadcastResult({
  summary,
  onNewMessage,
  onBackToMessage,
}: {
  summary: BroadcastSendSummary;
  onNewMessage: () => void;
  onBackToMessage: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { response, audienceLabel, subject, sentAt } = summary;
  const hasMicrosoftFailure = response.failures.some((failure) =>
    /@(hotmail|outlook|live|msn)\./i.test(failure.email),
  );
  const allFailed = response.sent === 0;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const feedback: Feedback = {
    tone: allFailed ? "error" : response.failed > 0 ? "info" : "success",
    text: allFailed
      ? "Aucun message n’a pu être envoyé. Votre texte est conservé : vous pouvez réessayer."
      : response.failed > 0
        ? "Le message est parti, mais quelques adresses n’ont pas pu être jointes."
        : "Le message a bien été envoyé.",
  };

  return (
    <section className="panel space-y-5 p-5 sm:p-6" aria-labelledby="broadcast-result-title">
      <div>
        <span className="eyebrow">Envoi terminé</span>
        <h2
          id="broadcast-result-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 focus:outline-none"
        >
          Résumé de l’envoi
        </h2>
      </div>

      <StatusMessage feedback={feedback} />

      <dl className="space-y-2 text-sm text-slate-700">
        <div>
          <dt className="inline font-semibold">Envoyé le : </dt>
          <dd className="inline">{sentAt}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">À : </dt>
          <dd className="inline">{audienceLabel}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Objet : </dt>
          <dd className="inline break-words">{subject}</dd>
        </div>
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="text-3xl font-extrabold text-emerald-900">{response.sent}</p>
          <p className="text-sm font-semibold text-emerald-900">
            envoyé{response.sent > 1 ? "s" : ""}
          </p>
        </div>
        <div
          className={`rounded-2xl p-4 ring-1 ${
            response.failed > 0
              ? "bg-rose-50 ring-rose-200"
              : "bg-slate-50 ring-slate-200"
          }`}
        >
          <p
            className={`text-3xl font-extrabold ${
              response.failed > 0 ? "text-rose-800" : "text-slate-700"
            }`}
          >
            {response.failed}
          </p>
          <p
            className={`text-sm font-semibold ${
              response.failed > 0 ? "text-rose-800" : "text-slate-700"
            }`}
          >
            échec{response.failed > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {response.failures.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-base font-bold text-amber-900">
            Adresse{response.failures.length > 1 ? "s" : ""} en échec
          </h3>
          <ul className="mt-2 space-y-2">
            {response.failures.map((failure) => (
              <li key={failure.email} className="text-sm text-amber-900">
                <span className="break-all font-semibold">{failure.email}</span>
                <span className="block text-amber-800">{failureLabel(failure.reason)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            {hasMicrosoftFailure
              ? "Pour une adresse Hotmail ou Outlook, la boîte est peut-être fermée : demandez une autre adresse à l’adhérent."
              : "Vérifiez l’adresse dans la fiche de l’adhérent, puis écrivez-lui à lui seul."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {allFailed ? (
          <button type="button" onClick={onBackToMessage} className="btn btn-primary">
            Revenir au message
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNewMessage}
          className={allFailed ? "btn btn-outline" : "btn btn-primary"}
        >
          Nouveau message
        </button>
      </div>

      <BroadcastDeliveryTips />
    </section>
  );
}
