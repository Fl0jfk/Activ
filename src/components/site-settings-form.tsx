"use client";

import { useState, type FormEvent } from "react";
import { SectionCard, type Feedback } from "@/components/bureau-ui";
import { Collapsible, SaveBar } from "@/components/site-content-ui";
import SiteImageField from "@/components/site-image-field";
import { randomId } from "@/lib/ids";
import type { AssociationData } from "@/lib/site-data-types";
import { saveSiteSections, type SiteSections } from "@/lib/use-site-data";
import { useBeforeUnloadWarning } from "@/lib/use-unsaved-warning";

type Association = AssociationData["association"];
type BoardMember = Association["organisation"]["boardMembers"][number];

type Props = {
  data: AssociationData;
  onSaved: (saved: SiteSections) => void;
};

/** Onglet « L’association » : coordonnées, organigramme et informations des reçus. */
export function AssociationSettingsSection({ data, onSaved }: Props) {
  const [association, setAssociation] = useState<Association>(data.association);
  const [baseline, setBaseline] = useState(() => JSON.stringify(data.association));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const dirty = JSON.stringify(association) !== baseline;
  useBeforeUnloadWarning(dirty);

  function update(patch: Partial<Association>) {
    setAssociation((previous) => ({ ...previous, ...patch }));
    setFeedback(null);
  }

  function updateBoard(boardMembers: BoardMember[], notes?: string) {
    setAssociation((previous) => ({
      ...previous,
      organisation: {
        ...previous.organisation,
        boardMembers,
        notes: notes ?? previous.organisation.notes,
      },
    }));
    setFeedback(null);
  }

  function updateMember(memberId: string, patch: Partial<BoardMember>) {
    updateBoard(
      association.organisation.boardMembers.map((member) => (member.id === memberId ? { ...member, ...patch } : member)),
    );
  }

  function reset() {
    setAssociation(JSON.parse(baseline) as Association);
    setFeedback(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!association.name.trim()) {
      setFeedback({ tone: "error", text: "Le nom de l’association est obligatoire." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await saveSiteSections({ association });
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        return;
      }
      const savedAssociation = result.saved.association ?? association;
      setAssociation(savedAssociation);
      setBaseline(JSON.stringify(savedAssociation));
      onSaved({ association: savedAssociation });
      setFeedback({ tone: "success", text: "Informations de l’association enregistrées." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-4">
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        <SectionCard
          title="Coordonnées"
          description="Ces informations sont affichées sur le site et dans le bas de page."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Nom de l’association <span className="font-normal text-slate-600">(obligatoire)</span>
              <input
                className="field"
                value={association.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </label>
            <label className="field-label">
              Phrase de présentation
              <input
                className="field"
                value={association.tagline}
                onChange={(event) => update({ tagline: event.target.value })}
                placeholder="Ex. Association sportive"
              />
            </label>
            <label className="field-label">
              Ville
              <input className="field" value={association.city} onChange={(event) => update({ city: event.target.value })} />
            </label>
            <label className="field-label">
              Adresse e-mail de contact
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                className="field"
                value={association.contactEmail}
                onChange={(event) => update({ contactEmail: event.target.value })}
                placeholder="contact@exemple.fr"
              />
            </label>
            <label className="field-label">
              Lien de la page Facebook
              <input
                inputMode="url"
                className="field"
                value={association.facebookUrl}
                onChange={(event) => update({ facebookUrl: event.target.value })}
                placeholder="https://www.facebook.com/…"
              />
            </label>
            <label className="field-label">
              Adresse postale
              <input
                className="field"
                value={association.address}
                onChange={(event) => update({ address: event.target.value })}
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Organigramme du bureau"
          description="La note et les membres sont affichés sur la page de l’association."
          action={
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                updateBoard([
                  ...association.organisation.boardMembers,
                  { id: randomId("board"), fullName: "", role: "", email: "" },
                ])
              }
            >
              Ajouter un membre
            </button>
          }
        >
          <label className="field-label">
            Note d’organigramme
            <textarea
              className="field"
              rows={3}
              value={association.organisation.notes}
              onChange={(event) => updateBoard(association.organisation.boardMembers, event.target.value)}
            />
          </label>
          <ul className="mt-4 space-y-3">
            {association.organisation.boardMembers.length === 0 ? (
              <li className="text-sm text-slate-600">Aucun membre pour le moment.</li>
            ) : null}
            {association.organisation.boardMembers.map((member, index) => (
              <li key={member.id} className="rounded-2xl border border-brand-line bg-brand-cream/40 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="field-label">
                    Nom et prénom
                    <input
                      className="field"
                      value={member.fullName}
                      onChange={(event) => updateMember(member.id, { fullName: event.target.value })}
                    />
                  </label>
                  <label className="field-label">
                    Fonction
                    <input
                      className="field"
                      value={member.role}
                      onChange={(event) => updateMember(member.id, { role: event.target.value })}
                      placeholder="Ex. Trésorier"
                    />
                  </label>
                  <label className="field-label">
                    Adresse e-mail
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      className="field"
                      value={member.email}
                      onChange={(event) => updateMember(member.id, { email: event.target.value })}
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={() =>
                      updateBoard(association.organisation.boardMembers.filter((entry) => entry.id !== member.id))
                    }
                    aria-label={`Retirer ${member.fullName.trim() || `le membre ${index + 1}`} de la liste`}
                  >
                    Retirer ce membre
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <Collapsible
          title="Avancé (reçus de paiement)"
          description="Numéros officiels, tampon et signature utilisés sur les reçus envoyés aux adhérents."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Numéro SIRET (facultatif)
              <input
                className="field"
                value={association.siret ?? ""}
                onChange={(event) => update({ siret: event.target.value })}
                placeholder="Ex. 123 456 789 00012"
              />
            </label>
            <label className="field-label">
              Numéro RNA (facultatif)
              <input
                className="field"
                value={association.rna ?? ""}
                onChange={(event) => update({ rna: event.target.value })}
                placeholder="Ex. W123456789"
              />
            </label>
            <SiteImageField
              label="Tampon de l’association"
              helpText="Affiché sur les reçus PDF envoyés aux adhérents après validation d’un paiement. Image PNG ou JPEG (un fond transparent est possible)."
              value={association.stampImageUrl}
              emptyValue=""
              onChange={(stampImageUrl) => update({ stampImageUrl })}
            />
            <SiteImageField
              label="Signature du président"
              helpText="Ajoutée au-dessus du nom du président sur les attestations de paiement. Une image PNG sur fond transparent donne le meilleur rendu."
              value={association.signatureImageUrl ?? ""}
              emptyValue=""
              onChange={(signatureImageUrl) => update({ signatureImageUrl })}
            />
          </div>
        </Collapsible>
      </fieldset>

      <SaveBar
        dirty={dirty}
        saving={saving}
        primaryLabel="Enregistrer"
        secondaryLabel={dirty ? "Annuler les modifications" : undefined}
        onSecondary={reset}
        feedback={feedback}
      />
    </form>
  );
}
