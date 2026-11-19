"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";

function ResultPanel({ tone, title, children }: { tone: "success" | "warning"; title: string; children: ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-8 sm:py-12">
      <section className="panel p-6 sm:p-8">
        <span
          aria-hidden
          className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white ${
            tone === "success" ? "bg-brand-green" : "bg-brand-orange"
          }`}
        >
          {tone === "success" ? "✓" : "!"}
        </span>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 focus:outline-none sm:text-3xl"
        >
          {title}
        </h1>
        <div className="mt-3 space-y-3 text-[15px] leading-6 text-slate-700">{children}</div>
      </section>
    </main>
  );
}

function PhoneLine() {
  return (
    <p>
      Une question ? Appelez le bureau au{" "}
      <a href={ASSOCIATION_PHONE_TEL} className="font-bold text-brand-blue underline underline-offset-2">
        {ASSOCIATION_PHONE_DISPLAY}
      </a>
      .
    </p>
  );
}

export function AlreadyReceivedScreen({ message }: { message?: string }) {
  return (
    <ResultPanel tone="success" title="Votre demande a déjà été reçue">
      <p>
        {message ||
          "Votre bulletin d’adhésion a déjà bien été reçu. Le bureau va le traiter et vous écrira par e-mail. Vous n’avez pas besoin de le renvoyer."}
      </p>
      <PhoneLine />
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <Link href="/" className="btn btn-primary">
          Retour à l’accueil
        </Link>
        <Link href="/sign-in?created=1" className="btn btn-outline">
          Se connecter
        </Link>
      </div>
    </ResultPanel>
  );
}

export function RevalidatedScreen() {
  return (
    <ResultPanel tone="success" title="Merci, votre bulletin est à jour">
      <p>
        Votre bulletin d’adhésion a bien été revalidé. Vous allez en recevoir une copie signée par e-mail. Vous n’avez rien
        d’autre à faire.
      </p>
      <PhoneLine />
      <div className="pt-2">
        <Link href="/" className="btn btn-primary">
          Retour à l’accueil
        </Link>
      </div>
    </ResultPanel>
  );
}

export function InvalidLinkScreen({
  message,
  onRetry,
  title = "Ce lien ne fonctionne pas",
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <ResultPanel tone="warning" title={title}>
      <p>{message}</p>
      <p>
        Si votre lien a expiré ou a déjà servi, demandez-en un nouveau au bureau de l’association. Vous pouvez aussi faire une
        nouvelle pré-inscription.
      </p>
      <PhoneLine />
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        {onRetry ? (
          <button type="button" onClick={onRetry} className="btn btn-primary">
            Réessayer
          </button>
        ) : (
          <Link href="/" className="btn btn-primary">
            Retour à l’accueil
          </Link>
        )}
        {onRetry ? (
          <Link href="/" className="btn btn-outline">
            Retour à l’accueil
          </Link>
        ) : null}
      </div>
    </ResultPanel>
  );
}
