"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ErrorSummary, { focusFirstError, type FieldErrors } from "@/components/forms/error-summary";
import { SelectField, TextAreaField, TextField } from "@/components/forms/field-controls";
import { MESSAGES, isValidEmail, isValidPhone } from "@/components/forms/validators";
import { fetchJson, jsonInit } from "@/lib/fetch-json";

type ContactFormProps = {
  associationName: string;
  disciplineNames: string[];
};

const FIELD_ORDER = ["firstName", "lastName", "email", "phone", "topic", "disciplineName", "message"] as const;

const FIELD_LABELS: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  email: "Adresse e-mail",
  phone: "Téléphone",
  topic: "Objet",
  disciplineName: "Discipline concernée",
  message: "Message",
};

const MESSAGE_MIN_LENGTH = 10;

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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const successRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<"success" | "error" | null>(null);

  const showDiscipline = topic === "trial" || topic === "discipline";

  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    if (request === "success") {
      successRef.current?.focus();
      successRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (!focusFirstError(errors, FIELD_ORDER)) {
      summaryRef.current?.focus();
    }
  });

  function clearError(key: string) {
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!firstName.trim()) found.firstName = MESSAGES.firstName;
    if (!lastName.trim()) found.lastName = MESSAGES.lastName;
    if (!email.trim()) found.email = MESSAGES.emailMissing;
    else if (!isValidEmail(email)) found.email = MESSAGES.email;
    if (phone.trim() && !isValidPhone(phone)) found.phone = MESSAGES.phone;
    if (message.trim().length < MESSAGE_MIN_LENGTH) {
      found.message = `Votre message doit contenir au moins ${MESSAGE_MIN_LENGTH} caractères.`;
    }
    return found;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const found = validate();
    setSuccess("");
    setFailure("");
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusRequest.current = "error";
      return;
    }

    setErrors({});
    setIsLoading(true);
    const result = await fetchJson("/api/contact", jsonInit("POST", {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      topic,
      disciplineName: showDiscipline ? disciplineName : "",
      message: message.trim(),
      website,
    }));
    setIsLoading(false);

    if (!result.ok) {
      setFailure(result.message || "Impossible d’envoyer le message. Réessayez dans un instant.");
      focusRequest.current = "error";
      return;
    }

    setSuccess(result.message || "Votre message a bien été envoyé.");
    focusRequest.current = "success";
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setTopic("trial");
    setDisciplineName("");
    setMessage("");
  }

  return (
    <section className="panel mt-6 p-5 sm:p-8" aria-labelledby="contact-form-title">
      <h2 id="contact-form-title" className="text-2xl font-extrabold tracking-tight text-slate-900">
        Formulaire de contact
      </h2>
      <p className="mt-2 text-[15px] leading-6 text-slate-700">
        Séance d’essai, question sur une activité ou autre demande — {associationName} vous répond par e-mail. Les champs
        sont obligatoires, sauf le téléphone.
      </p>

      {success ? (
        <div
          ref={successRef}
          tabIndex={-1}
          role="status"
          className="mt-5 rounded-2xl bg-emerald-50 p-4 text-[15px] font-semibold text-emerald-900 ring-1 ring-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <p>✓ {success}</p>
          <p className="mt-1 font-normal">Vous pouvez poser une autre question ci-dessous si besoin.</p>
        </div>
      ) : null}

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className="mt-6">
        <ErrorSummary errors={errors} labels={FIELD_LABELS} order={FIELD_ORDER} message={failure} summaryRef={summaryRef} />

        <div className="grid gap-5 sm:grid-cols-2">
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

          <TextField
            name="firstName"
            label="Prénom"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              clearError("firstName");
            }}
            error={errors.firstName}
            autoComplete="given-name"
            disabled={isLoading}
          />
          <TextField
            name="lastName"
            label="Nom"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              clearError("lastName");
            }}
            error={errors.lastName}
            autoComplete="family-name"
            disabled={isLoading}
          />
          <TextField
            name="email"
            label="Adresse e-mail"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError("email");
            }}
            error={errors.email}
            autoComplete="email"
            disabled={isLoading}
          />
          <TextField
            name="phone"
            label="Téléphone"
            optional
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearError("phone");
            }}
            error={errors.phone}
            autoComplete="tel"
            disabled={isLoading}
          />
          <SelectField
            name="topic"
            label="Objet de votre message"
            className="sm:col-span-2"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isLoading}
          >
            <option value="trial">Demande de séance d’essai</option>
            <option value="discipline">Question sur une discipline</option>
            <option value="registration">Inscription / pré-inscription</option>
            <option value="other">Autre</option>
          </SelectField>
          {showDiscipline ? (
            disciplineNames.length > 0 ? (
              <SelectField
                name="disciplineName"
                label="Discipline concernée"
                optional
                className="sm:col-span-2"
                value={disciplineName}
                onChange={(e) => setDisciplineName(e.target.value)}
                disabled={isLoading}
              >
                <option value="">— Choisir —</option>
                {disciplineNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <TextField
                name="disciplineName"
                label="Discipline concernée"
                optional
                className="sm:col-span-2"
                value={disciplineName}
                onChange={(e) => setDisciplineName(e.target.value)}
                placeholder="Ex. Yoga sur chaise"
                disabled={isLoading}
              />
            )
          ) : null}
          <TextAreaField
            name="message"
            label="Votre message"
            className="sm:col-span-2"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              clearError("message");
            }}
            rows={5}
            placeholder="Décrivez votre demande (dates souhaitées, niveau, questions…)"
            error={errors.message}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
            <button type="submit" disabled={isLoading} aria-busy={isLoading || undefined} className="btn btn-primary">
              {isLoading ? "Envoi en cours…" : "Envoyer le message"}
            </button>
            <Link href="/" className="btn btn-ghost">
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </form>
    </section>
  );
}
