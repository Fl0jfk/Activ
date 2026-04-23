"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DisciplineOption = { id: string; name: string };
type TrialSlot = { id: string; disciplineId: string; title: string; startsAt: string };

type PublicPreregistrationFormProps = {
  disciplines: DisciplineOption[];
  slots: TrialSlot[];
};

export default function PublicPreregistrationForm({ disciplines, slots }: PublicPreregistrationFormProps) {
  const router = useRouter();
  const [disciplineId, setDisciplineId] = useState(disciplines[0]?.id ?? "");
  const [trialSlotId, setTrialSlotId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [motivation, setMotivation] = useState("");
  const [documents, setDocuments] = useState<{ name: string; url: string; uploadedAt: string }[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const disciplineSlots = useMemo(
    () => slots.filter((slot) => slot.disciplineId === disciplineId),
    [disciplineId, slots],
  );

  async function uploadDocument(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/public-temp-documents", { method: "POST", body: formData });
    const payload = (await response.json()) as { name?: string; url?: string; uploadedAt?: string; message?: string };
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
      setMessage("Pieces jointes ajoutees.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur d'upload.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    setMessage("");
    const response = await fetch("/api/public-preinscriptions", {
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
        password,
        motivation,
        documents,
      }),
    });
    const payload = (await response.json()) as { message?: string };
    setMessage(payload.message ?? (response.ok ? "Demande envoyee." : "Erreur."));
    setIsLoading(false);
    if (response.ok) {
      setMotivation("");
      setTrialSlotId("");
      setPassword("");
      setPasswordConfirm("");
      setDocuments([]);
      router.push("/?preregistration=received");
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Pre-inscription</h1>
        <p className="mt-2 text-slate-700">
          Remplis ce formulaire unique. Ton compte sera cree automatiquement en arriere-plan.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-3 sm:grid-cols-2">
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
            Prenom
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-normal" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nom
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-normal" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Telephone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-normal" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-normal" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Confirmer le mot de passe
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
              minLength={8}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Adresse
            <input value={address} onChange={(event) => setAddress(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-normal" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Code postal
            <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-normal" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Ville
            <input value={city} onChange={(event) => setCity(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 font-normal" required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
            Pieces jointes (certificat medical, justificatif)
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
              <p className="text-sm font-semibold text-slate-900">Pieces jointes ajoutees</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {documents.map((doc) => (
                  <li key={`${doc.url}-${doc.uploadedAt}`}>- {doc.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
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
            Message (optionnel)
            <textarea
              value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
              rows={3}
              className="rounded-xl border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading || isUploading || !disciplineId}
            className="rounded-xl bg-cyan-700 px-5 py-3 font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            Envoyer ma pre-inscription
          </button>
        </form>
        {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
      </section>
    </main>
  );
}
