"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type ContactFormProps = {
  associationName: string;
  disciplineNames: string[];
};

export default function ContactForm({
  associationName,
  disciplineNames,
}: ContactFormProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [topic, setTopic] = useState("trial");
  const [disciplineName, setDisciplineName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const showDiscipline = topic === "trial" || topic === "discipline";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setFeedback("");
    setIsSuccess(false);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          topic,
          disciplineName: showDiscipline ? disciplineName : "",
          message,
          website,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Impossible d'envoyer le message.");
      }

      setIsSuccess(true);
      setFeedback(payload.message ?? "Message envoyé.");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setTopic("trial");
      setDisciplineName("");
      setMessage("");
    } catch (error) {
      setIsSuccess(false);
      setFeedback(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel mt-6 p-6 sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">Formulaire de contact</h2>
      <p className="mt-2 text-sm text-slate-600">
        Séance d&apos;essai, question sur une activité ou autre demande — {associationName} vous répond par e-mail.
      </p>

      {isSuccess ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {feedback}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
        />

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Prénom *
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            required
            disabled={isLoading}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nom *
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            required
            disabled={isLoading}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          E-mail *
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            required
            disabled={isLoading}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Téléphone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            disabled={isLoading}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Objet *
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            disabled={isLoading}
          >
            <option value="trial">Demande de séance d&apos;essai</option>
            <option value="discipline">Question sur une discipline</option>
            <option value="registration">Inscription / pré-inscription</option>
            <option value="other">Autre</option>
          </select>
        </label>
        {showDiscipline ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Discipline concernée
            {disciplineNames.length > 0 ? (
              <select
                value={disciplineName}
                onChange={(e) => setDisciplineName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                disabled={isLoading}
              >
                <option value="">— Choisir —</option>
                {disciplineNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={disciplineName}
                onChange={(e) => setDisciplineName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
                placeholder="Ex. Yoga chaise"
                disabled={isLoading}
              />
            )}
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Message *
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            placeholder="Décrivez votre demande (dates souhaitées, niveau, questions…)"
            required
            minLength={10}
            disabled={isLoading}
          />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isLoading ? "Envoi en cours…" : "Envoyer le message"}
          </button>
          <Link
            href="/"
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </form>

      {!isSuccess && feedback ? (
        <p className="mt-4 text-sm font-medium text-rose-700">{feedback}</p>
      ) : null}
    </section>
  );
}
