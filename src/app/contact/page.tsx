import type { Metadata } from "next";
import CallButton from "@/components/call-button";
import ContactForm from "@/components/contact-form";
import OrientationAssistant from "@/components/orientation-assistant";
import { ASSOCIATION_PHONE_DISPLAY, ASSOCIATION_PHONE_TEL } from "@/lib/association-contact";
import { buildPageMetadata, SITE_LOCALITY } from "@/lib/seo";
import { readPublicSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: `Contact et séance d'essai à ${SITE_LOCALITY}`,
  description: `Contactez Activ' Sainte-Croix pour une séance d'essai, un renseignement ou une question sur nos activités à ${SITE_LOCALITY}.`,
  path: "/contact",
});

export default async function ContactPage() {
  const data = await readPublicSiteData();
  const { association } = data;
  const disciplineNames = data.disciplines.filter((d) => d.active).map((d) => d.name);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <header className="panel p-6 sm:p-8">
        <span className="eyebrow">Contact</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{association.name}</h1>
        <p className="mt-3 text-slate-700">
          Pour demander une séance d&apos;essai, proposer une date ou poser une question sur les activités, utilisez le
          formulaire ci-dessous.
        </p>
        {association.address ? (
          <p className="mt-2 text-sm text-slate-600">
            {association.address}
            {association.city ? ` — ${association.city}` : ""}
          </p>
        ) : null}
        <div className="mt-4 flex items-center gap-3">
          <CallButton />
          <a href={ASSOCIATION_PHONE_TEL} className="text-base font-bold text-brand-blue hover:underline">
            Appeler le {ASSOCIATION_PHONE_DISPLAY}
          </a>
        </div>
      </header>

      <OrientationAssistant
        className="mt-6"
        title="Besoin d'un conseil avant de nous écrire ?"
        subtitle="Notre assistant vous aide à choisir une activité en quelques questions."
        buttonLabel="Demander conseil"
      />

      <ContactForm
        associationName={association.name}
        disciplineNames={disciplineNames}
      />
    </main>
  );
}
