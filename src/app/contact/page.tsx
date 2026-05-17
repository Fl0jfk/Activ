import ContactForm from "@/components/contact-form";
import { isMailConfigured } from "@/lib/mailer";
import { readSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const data = await readSiteData();
  const { association } = data;
  const disciplineNames = data.disciplines.filter((d) => d.active).map((d) => d.name);
  const mailConfigured = isMailConfigured();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <header className="panel p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Contact</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">{association.name}</h1>
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
      </header>

      <ContactForm
        associationName={association.name}
        contactEmail={association.contactEmail}
        disciplineNames={disciplineNames}
        mailConfigured={mailConfigured}
      />
    </main>
  );
}
