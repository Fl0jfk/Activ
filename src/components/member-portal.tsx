"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

type DisciplineOption = { id: string; name: string };
type TrialSlot = { id: string; disciplineId: string; title: string; startsAt: string; capacity: number };
type Application = {
  id: string;
  requestKind: "trial_and_preregistration" | "trial_only";
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  documents: { name: string; url: string; uploadedAt: string }[];
  disciplineId: string;
  trialSlotId: string | null;
  motivation: string;
  createdAt: string;
  status: "pending" | "awaiting_document" | "approved" | "rejected";
  trialAttended: boolean;
  paymentStatus: "unpaid" | "partial" | "paid";
  paymentMethod: "cash" | "check" | "bank_transfer" | "card" | "other" | "";
  licenseEndDate: string | null;
  notes: string;
};

type MemberPortalProps = {
  disciplines: DisciplineOption[];
  slots: TrialSlot[];
  applications: Application[];
};

export default function MemberPortal({ disciplines, slots, applications }: MemberPortalProps) {
  const [disciplineId, setDisciplineId] = useState(disciplines[0]?.id ?? "");
  const [trialSlotId, setTrialSlotId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [motivation, setMotivation] = useState("");
  const [documents, setDocuments] = useState<{ name: string; url: string; uploadedAt: string }[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const disciplineSlots = useMemo(
    () => slots.filter((slot) => slot.disciplineId === disciplineId),
    [disciplineId, slots],
  );
  const pendingWithoutTrial = applications.filter(
    (application) => !application.trialSlotId && (application.status === "pending" || application.status === "awaiting_document"),
  );

  async function uploadDocument(file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/club/documents", { method: "POST", body });
    const payload = (await response.json()) as { message?: string; name?: string; url?: string; uploadedAt?: string };
    if (!response.ok || !payload.name || !payload.url || !payload.uploadedAt) {
      throw new Error(payload.message ?? "Upload impossible.");
    }
    return { name: payload.name, url: payload.url, uploadedAt: payload.uploadedAt };
  }

  async function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    setIsUploading(true);
    setMessage("");
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => uploadDocument(file)));
      setDocuments((previous) => [...previous, ...uploaded]);
      setMessage("Documents ajoutes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur d'upload.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    const response = await fetch("/api/club/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disciplineId,
        trialSlotId: trialSlotId || undefined,
        firstName,
        lastName,
        phone,
        address,
        postalCode,
        city,
        email,
        motivation,
        documents,
      }),
    });

    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Demande envoyee." : "Erreur."));
    setIsLoading(false);
    if (response.ok) {
      setFirstName("");
      setLastName("");
      setPhone("");
      setAddress("");
      setPostalCode("");
      setCity("");
      setEmail("");
      setMotivation("");
      setDocuments([]);
      setTrialSlotId("");
      window.location.reload();
    }
  }

  async function addTrialRequest(applicationId: string, selectedTrialSlotId: string) {
    if (!selectedTrialSlotId) {
      setMessage("Selectionne un creneau d'essai.");
      return;
    }
    const response = await fetch(`/api/club/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trialSlotId: selectedTrialSlotId }),
    });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Demande d'essai ajoutee." : "Erreur."));
    if (response.ok) {
      window.location.reload();
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-bold text-slate-900">Mon espace</h1>
      <p className="mt-2 text-slate-700">Demande une pre-inscription, choisis ta seance d&apos;essai et suis ton statut.</p>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Nouvelle pre-inscription</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Prenom
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nom
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Telephone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Email de contact
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              placeholder="Laisse vide pour utiliser ton email Clerk"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Adresse
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Code postal
            <input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ville
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Documents (certificat medical, justificatifs)
            <input
              type="file"
              multiple
              onChange={handleFilesChange}
              disabled={isUploading}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          {documents.length > 0 ? (
            <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Documents ajoutes</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {documents.map((doc) => (
                  <li key={`${doc.url}-${doc.uploadedAt}`}>- {doc.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Discipline
            <select
              value={disciplineId}
              onChange={(event) => {
                setDisciplineId(event.target.value);
                setTrialSlotId("");
              }}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            >
              {disciplines.map((discipline) => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Date d&apos;essai (optionnel)
            <select
              value={trialSlotId}
              onChange={(event) => setTrialSlotId(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            >
              <option value="">Je choisis plus tard</option>
              {disciplineSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {new Date(slot.startsAt).toLocaleString("fr-FR")} - {slot.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Pourquoi veux-tu rejoindre cette activite&nbsp;?
            <textarea
              value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              rows={3}
              placeholder="Ex: Je souhaite commencer le yoga pour le renforcement et la souplesse."
            />
          </label>
          <button
            type="submit"
            disabled={isLoading || isUploading || !disciplineId}
            className="rounded-xl bg-cyan-700 px-5 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            Envoyer ma demande
          </button>
        </form>
        {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
      </section>

      {pendingWithoutTrial.length > 0 ? (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Ajouter une demande d&apos;essai plus tard</h2>
          <div className="mt-4 space-y-3">
            {pendingWithoutTrial.map((application) => (
              <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-700">
                  Dossier en attente pour {application.firstName} {application.lastName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slots
                    .filter((slot) => slot.disciplineId === application.disciplineId)
                    .map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => void addTrialRequest(application.id, slot.id)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs"
                    >
                      {new Date(slot.startsAt).toLocaleDateString("fr-FR")} - {slot.title}
                    </button>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Mes demandes</h2>
        <div className="mt-4 space-y-3">
          {applications.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune demande pour le moment.</p>
          ) : (
            applications.map((application) => (
              <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-700">
                  Statut: <span className="font-semibold">{application.status}</span> | Paiement:{" "}
                  <span className="font-semibold">{application.paymentStatus}</span> | Essai realise:{" "}
                  <span className="font-semibold">{application.trialAttended ? "Oui" : "Non"}</span>
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Contact: {application.email} - {application.phone} - {application.address}
                </p>
                <p className="mt-1 text-sm text-slate-700">{application.postalCode} {application.city}</p>
                {application.licenseEndDate ? (
                  <p className="mt-1 text-sm text-slate-700">Fin de licence: {application.licenseEndDate}</p>
                ) : null}
                {application.documents.length > 0 ? (
                  <p className="mt-1 text-sm text-slate-700">Documents fournis: {application.documents.length}</p>
                ) : null}
                {application.notes ? <p className="mt-1 text-sm text-slate-700">Note admin: {application.notes}</p> : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
