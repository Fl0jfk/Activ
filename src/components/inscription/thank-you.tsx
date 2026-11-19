"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ASSOCIATION_PAYEE } from "@/components/inscription/steps-config";
import { formatEuros } from "@/components/inscription/format";
import { parseDone, useDoneRaw } from "@/components/inscription/storage";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import { paymentPlanLabel } from "@/lib/membership-bulletin";

/** Page affichée après l'envoi du bulletin : explique la suite, sans rien mettre dans l'adresse de la page. */
export default function ThankYou() {
  const raw = useDoneRaw();
  const info = useMemo(() => parseDone(raw), [raw]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="panel p-6 sm:p-8">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-2xl font-bold text-white"
        >
          ✓
        </span>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 focus:outline-none sm:text-3xl"
        >
          Merci, votre pré-inscription est envoyée
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-slate-700">
          {info?.firstName ? `${info.firstName}, nous` : "Nous"} avons bien reçu votre dossier.{" "}
          {info?.email ? (
            <>
              Une copie de votre bulletin signé vous est envoyée à <strong className="break-all">{info.email}</strong>.
            </>
          ) : (
            "Une copie de votre bulletin signé vous est envoyée par e-mail."
          )}
        </p>

        <h2 className="mt-7 text-xl font-extrabold text-slate-900">Et maintenant ?</h2>
        <ol className="mt-3 space-y-4 text-[15px] leading-6 text-slate-700">
          <li className="flex gap-3">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
              1
            </span>
            <span>
              <strong className="text-slate-900">Le bureau étudie votre dossier.</strong> Cela peut prendre quelques jours.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
              2
            </span>
            <span>
              <strong className="text-slate-900">Vous recevez un e-mail</strong> dès que votre espace adhérent est activé.
              Pensez à regarder aussi dans vos courriers indésirables.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
              3
            </span>
            <span>
              <strong className="text-slate-900">Vous vous connectez</strong> avec l’adresse e-mail et le mot de passe que
              vous avez choisis lors de votre inscription.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">
              4
            </span>
            <span>
              <strong className="text-slate-900">Vous réglez votre cotisation auprès du bureau</strong> (pas de paiement en
              ligne).
              {info && info.grandTotal > 0 ? (
                <span className="mt-2 block rounded-xl bg-brand-cream px-4 py-3 ring-1 ring-brand-line">
                  <span className="block font-bold text-slate-900">Montant à régler : {formatEuros(info.grandTotal)}</span>
                  <span className="block">{paymentPlanLabel(info.paymentPlan)}</span>
                  <span className="block text-sm text-slate-600">Chèques à l’ordre de « {ASSOCIATION_PAYEE} ».</span>
                </span>
              ) : (
                <span className="block text-slate-600">
                  Le montant et le mode de paiement sont rappelés dans le bulletin reçu par e-mail.
                </span>
              )}
            </span>
          </li>
        </ol>

        <p className="mt-6 text-[15px] leading-6 text-slate-700">
          Une question ? Appelez le bureau au{" "}
          <a href={ASSOCIATION_PHONE_TEL} className="font-bold text-brand-blue underline underline-offset-2">
            {ASSOCIATION_PHONE_DISPLAY}
          </a>
          .
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn btn-primary">
            Retour à l’accueil
          </Link>
          <Link href="/sign-in?created=1" className="btn btn-outline">
            Se connecter
          </Link>
        </div>
      </section>
    </main>
  );
}
