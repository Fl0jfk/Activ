"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, ConfirmDialog, EmptyState, SectionCard, StatusMessage, type Feedback } from "@/components/bureau-ui";
import { Collapsible, NewTabLink, SaveBar } from "@/components/site-content-ui";
import SiteImage from "@/components/site-image";
import SiteNewsForm, { emptyPollDraft, pollToDraft, type PollDraft } from "@/components/site-news-form";
import { randomId } from "@/lib/ids";
import { pollVoteTotal } from "@/lib/site-polls";
import {
  emptySiteNewsItem,
  formatEventSchedule,
  isNewsArchived,
  newsKindLabel,
  resolveNewsDisciplineLabel,
  sortNewsByDateDesc,
  todayIsoLocal,
  truncateNewsDescription,
} from "@/lib/site-news";
import type { AssociationData, SiteNewsItem, SitePoll } from "@/lib/site-data-types";
import { saveFromFreshData, type SiteSections } from "@/lib/use-site-data";

const DEFAULT_CTA = "Lire la suite";
const POLL_CTA = "Donner son avis";

type ConfirmState =
  | { kind: "delete-news"; item: SiteNewsItem }
  | { kind: "delete-orphan"; poll: SitePoll }
  | { kind: "lose-poll"; poll: SitePoll }
  | { kind: "discard" }
  | null;

function voteLabel(count: number): string {
  return count === 0 ? "Aucun vote" : count === 1 ? "1 vote" : `${count} votes`;
}

function needsMoreOptions(item: SiteNewsItem): boolean {
  return Boolean(
    item.kind === "sondage" ||
      item.location ||
      item.startTime ||
      item.endTime ||
      item.disciplineId ||
      (item.galleryImages ?? []).length > 0,
  );
}

type Props = {
  data: AssociationData;
  onSaved: (saved: SiteSections) => void;
};

export default function SiteNewsPanel({ data, onSaved }: Props) {
  const topRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

  const [draft, setDraft] = useState<SiteNewsItem | null>(null);
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft);
  const [isNew, setIsNew] = useState(false);
  const [snapshot, setSnapshot] = useState("");
  const [previousKind, setPreviousKind] = useState("evenement");
  const [moreOpen, setMoreOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listFeedback, setListFeedback] = useState<Feedback>(null);
  const [formFeedback, setFormFeedback] = useState<Feedback>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [showArchives, setShowArchives] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  const isEditing = draft !== null;

  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isEditing]);

  const pollsByNewsId = useMemo(() => {
    const map = new Map<string, SitePoll>();
    for (const poll of data.polls) {
      if (poll.newsId && !map.has(poll.newsId)) map.set(poll.newsId, poll);
    }
    return map;
  }, [data.polls]);

  const { currentNews, archivedNews } = useMemo(() => {
    const current: SiteNewsItem[] = [];
    const archived: SiteNewsItem[] = [];
    for (const item of sortNewsByDateDesc(data.news)) {
      (isNewsArchived(item.date) ? archived : current).push(item);
    }
    return { currentNews: current, archivedNews: archived };
  }, [data.news]);

  const orphanPolls = useMemo(
    () => data.polls.filter((poll) => !poll.newsId || !data.news.some((item) => item.id === poll.newsId)),
    [data.polls, data.news],
  );

  const dirty = draft !== null && JSON.stringify({ item: draft, poll: pollDraft }) !== snapshot;
  const savedPoll = draft
    ? ((pollDraft.id ? data.polls.find((poll) => poll.id === pollDraft.id) : undefined) ??
      pollsByNewsId.get(draft.id) ??
      null)
    : null;

  async function runSave(
    compute: Parameters<typeof saveFromFreshData>[0],
    onFeedback: (feedback: Feedback) => void,
    successText: string,
  ): Promise<boolean> {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await saveFromFreshData(compute);
      if (!result.ok) {
        onFeedback({ tone: "error", text: result.message });
        return false;
      }
      onSaved(result.saved);
      onFeedback({ tone: "success", text: successText });
      return true;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function openForm(item: SiteNewsItem, poll: PollDraft, creating: boolean) {
    setDraft(item);
    setPollDraft(poll);
    setIsNew(creating);
    setSnapshot(JSON.stringify({ item, poll }));
    setPreviousKind(item.kind === "sondage" ? "evenement" : item.kind);
    setMoreOpen(needsMoreOptions(item));
    setShowErrors(false);
    setFormFeedback(null);
    setListFeedback(null);
  }

  function startCreate() {
    openForm({ ...emptySiteNewsItem(), id: randomId("news"), date: todayIsoLocal() }, emptyPollDraft(), true);
  }

  function startEdit(item: SiteNewsItem) {
    const linked = pollsByNewsId.get(item.id);
    openForm(
      { ...item, ctaLabel: item.ctaLabel?.trim() || (item.kind === "sondage" ? POLL_CTA : DEFAULT_CTA) },
      linked ? pollToDraft(linked) : emptyPollDraft(),
      false,
    );
  }

  function closeForm() {
    setDraft(null);
    setPollDraft(emptyPollDraft());
    setFormFeedback(null);
    setShowErrors(false);
  }

  function requestCancel() {
    if (dirty) {
      setConfirm({ kind: "discard" });
      return;
    }
    closeForm();
  }

  function updateDraft(patch: Partial<SiteNewsItem>) {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
  }

  function changeKindMode(mode: "news" | "poll") {
    if (!draft) return;
    if (mode === "poll") {
      if (draft.kind !== "sondage") setPreviousKind(draft.kind);
      const cta = draft.ctaLabel?.trim();
      updateDraft({ kind: "sondage", ctaLabel: !cta || cta === DEFAULT_CTA ? POLL_CTA : cta });
      setMoreOpen(true);
      return;
    }
    const cta = draft.ctaLabel?.trim();
    updateDraft({ kind: previousKind || "evenement", ctaLabel: !cta || cta === POLL_CTA ? DEFAULT_CTA : cta });
  }

  async function publish(pollRemovalConfirmed = false) {
    if (!draft || savingRef.current) return;

    const title = draft.title.trim();
    const isPoll = draft.kind === "sondage";
    const question = pollDraft.question.trim();
    const answers = pollDraft.options.map((option) => ({ ...option, label: option.label.trim() })).filter((option) => option.label);

    setShowErrors(true);
    if (!title || !draft.date) {
      setFormFeedback({
        tone: "error",
        text: !title ? "Le titre est obligatoire." : "La date est obligatoire.",
      });
      return;
    }
    if (isPoll && !question) {
      setMoreOpen(true);
      setFormFeedback({ tone: "error", text: "Ajoutez la question du sondage (dans « Plus d’options »)." });
      return;
    }
    if (isPoll && answers.length < 2) {
      setMoreOpen(true);
      setFormFeedback({ tone: "error", text: "Ajoutez au moins deux réponses au sondage (dans « Plus d’options »)." });
      return;
    }

    if (!isPoll && savedPoll && !pollRemovalConfirmed) {
      setConfirm({ kind: "lose-poll", poll: savedPoll });
      return;
    }

    const item: SiteNewsItem = {
      ...draft,
      title,
      description: draft.description.trim(),
      location: draft.location.trim(),
      disciplineId: draft.disciplineId || null,
      ctaLabel: draft.ctaLabel?.trim() || (isPoll ? POLL_CTA : DEFAULT_CTA),
      imageUrl: draft.imageUrl?.trim() ?? "",
      galleryImages: Array.isArray(draft.galleryImages) ? draft.galleryImages : [],
    };

    setFormFeedback(null);
    const ok = await runSave(
      (fresh) => {
        const existingPoll =
          (pollDraft.id ? fresh.polls.find((poll) => poll.id === pollDraft.id) : undefined) ??
          fresh.polls.find((poll) => poll.newsId === item.id);
        const polls = fresh.polls.filter((poll) => poll.newsId !== item.id && poll.id !== existingPoll?.id);
        if (isPoll) {
          polls.unshift({
            id: existingPoll?.id ?? randomId("poll"),
            question,
            // Les votes suivent l’identifiant de chaque réponse, jamais sa position.
            options: answers.map((answer) => ({
              id: answer.id,
              label: answer.label,
              votes: existingPoll?.options.find((option) => option.id === answer.id)?.votes ?? 0,
            })),
            newsId: item.id,
            status: existingPoll?.status ?? "open",
            createdAt: existingPoll?.createdAt ?? new Date().toISOString(),
            closedAt: existingPoll?.closedAt ?? null,
          });
        }
        return {
          news: sortNewsByDateDesc([...fresh.news.filter((entry) => entry.id !== item.id), item]),
          polls,
        };
      },
      setFormFeedback,
      "",
    );
    if (ok) {
      closeForm();
      setListFeedback({
        tone: "success",
        text: isNew ? "Actualité publiée sur le site." : "Modifications publiées sur le site.",
      });
    }
  }

  async function confirmAction() {
    const current = confirm;
    if (!current) return;

    if (current.kind === "discard") {
      setConfirm(null);
      closeForm();
      return;
    }
    if (current.kind === "lose-poll") {
      setConfirm(null);
      await publish(true);
      return;
    }
    if (current.kind === "delete-news") {
      const { item } = current;
      await runSave(
        (fresh) => ({
          news: fresh.news.filter((entry) => entry.id !== item.id),
          // Le sondage appartenait à cette actualité : il disparaît avec elle.
          polls: fresh.polls.filter((poll) => poll.newsId !== item.id),
        }),
        setListFeedback,
        "Actualité supprimée du site.",
      );
      setConfirm(null);
      return;
    }
    const { poll } = current;
    await runSave(
      (fresh) => ({ polls: fresh.polls.filter((entry) => entry.id !== poll.id) }),
      setListFeedback,
      "Sondage supprimé du site.",
    );
    setConfirm(null);
  }

  function renderNewsCard(item: SiteNewsItem) {
    const poll = pollsByNewsId.get(item.id);
    const archived = isNewsArchived(item.date);
    const schedule = formatEventSchedule(item);
    return (
      <li key={item.id} className="flex flex-col gap-4 rounded-2xl border border-brand-line bg-white p-4 sm:flex-row">
        <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-44">
          {item.imageUrl ? (
            <SiteImage
              src={item.imageUrl}
              alt={`Photo de l’actualité « ${item.title} »`}
              fill
              sizes="176px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center px-2 text-center text-sm text-slate-600">
              Pas de photo
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Badge tone={archived ? "slate" : "green"}>{archived ? "Archivée" : "En ligne"}</Badge>
            {poll ? (
              <Badge tone="violet">
                Sondage · {voteLabel(pollVoteTotal(poll))}
                {poll.status === "closed" ? " · arrêté" : ""}
              </Badge>
            ) : (
              <Badge tone="blue">{newsKindLabel(item.kind)}</Badge>
            )}
            {item.disciplineId ? (
              <Badge tone="slate">{resolveNewsDisciplineLabel(item.disciplineId, data.disciplines)}</Badge>
            ) : null}
          </div>
          <h3 className="text-break mt-2 text-lg font-bold text-slate-900">{item.title || "Sans titre"}</h3>
          {schedule ? <p className="mt-1 text-sm font-medium text-slate-700">{schedule}</p> : null}
          {item.location ? <p className="mt-1 text-sm text-slate-600">Lieu : {item.location}</p> : null}
          {item.description ? (
            <p className="text-break mt-2 text-sm text-slate-600">{truncateNewsDescription(item.description, 160)}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startEdit(item)}
              disabled={saving}
              className="btn btn-outline btn-sm"
              aria-label={`Modifier l’actualité « ${item.title} »`}
            >
              Modifier
            </button>
            <NewTabLink href={`/actualites/${encodeURIComponent(item.id)}`}>
              <span aria-hidden="true">Voir sur le site</span>
              <span className="sr-only">Voir « {item.title} » sur le site</span>
            </NewTabLink>
            <button
              type="button"
              onClick={() => setConfirm({ kind: "delete-news", item })}
              disabled={saving}
              className="btn btn-ghost btn-sm border-rose-200 text-rose-700 hover:bg-rose-50"
              aria-label={`Supprimer l’actualité « ${item.title} »`}
            >
              Supprimer
            </button>
          </div>
        </div>
      </li>
    );
  }

  const confirmCopy = (() => {
    switch (confirm?.kind) {
      case "delete-news": {
        const hasPoll = pollsByNewsId.has(confirm.item.id);
        return {
          title: "Supprimer cette actualité ?",
          message: (
            <>
              « {confirm.item.title} » sera retirée du site
              {hasPoll ? ", ainsi que son sondage et tous ses votes" : ""}. Cette action est définitive.
            </>
          ),
          confirmLabel: "Supprimer",
          cancelLabel: "Garder",
          tone: "danger" as const,
        };
      }
      case "delete-orphan":
        return {
          title: "Supprimer ce sondage ?",
          message: (
            <>
              Le sondage « {confirm.poll.question} » ({voteLabel(pollVoteTotal(confirm.poll))}) sera retiré du site.
              Cette action est définitive.
            </>
          ),
          confirmLabel: "Supprimer",
          cancelLabel: "Garder",
          tone: "danger" as const,
        };
      case "lose-poll":
        return {
          title: "Retirer le sondage ?",
          message: (
            <>
              Vous avez choisi « Actualité » : le sondage « {confirm.poll.question} » et ses{" "}
              {voteLabel(pollVoteTotal(confirm.poll)).toLowerCase()} seront supprimés définitivement à la publication.
            </>
          ),
          confirmLabel: "Retirer le sondage et publier",
          cancelLabel: "Revenir à la modification",
          tone: "danger" as const,
        };
      default:
        return {
          title: "Abandonner les modifications ?",
          message: "Ce que vous avez saisi n’a pas été publié et sera perdu.",
          confirmLabel: "Abandonner",
          cancelLabel: "Continuer à modifier",
          tone: "danger" as const,
        };
    }
  })();

  return (
    <div ref={topRef} className="anchor-section space-y-4">
      {draft ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void publish();
          }}
          className="space-y-4"
        >
          <SectionCard
            title={isNew ? "Nouvelle actualité" : "Modifier l’actualité"}
            description="Remplissez le titre, la date, le texte et la photo, puis cliquez sur « Publier ». Les autres réglages sont facultatifs."
            action={
              <button type="button" onClick={requestCancel} disabled={saving} className="btn btn-ghost btn-sm">
                Retour à la liste
              </button>
            }
          >
            <SiteNewsForm
              mode={isNew ? "create" : "edit"}
              value={draft}
              onChange={updateDraft}
              onKindModeChange={changeKindMode}
              poll={pollDraft}
              onPollChange={(patch) => setPollDraft((previous) => ({ ...previous, ...patch }))}
              savedPoll={savedPoll}
              disciplines={data.disciplines}
              busy={saving}
              moreOpen={moreOpen}
              onMoreOpenChange={setMoreOpen}
              invalidTitle={showErrors && !draft.title.trim()}
              invalidDate={showErrors && !draft.date}
            />
          </SectionCard>
          <SaveBar
            dirty={dirty}
            saving={saving}
            primaryLabel={isNew ? "Publier" : "Publier les modifications"}
            savingLabel="Publication en cours…"
            secondaryLabel="Annuler"
            onSecondary={requestCancel}
            feedback={formFeedback}
          />
        </form>
      ) : (
        <>
          <SectionCard
            title="Actualités"
            description="Elles apparaissent sur l’accueil et sur la page Actualités du site. Les actualités de plus d’un mois sont rangées dans les archives, plus bas sur cette page."
            action={
              <>
                <NewTabLink href="/actualites">Voir sur le site</NewTabLink>
                <button type="button" onClick={startCreate} disabled={saving} className="btn btn-primary">
                  Ajouter une actualité
                </button>
              </>
            }
          >
            <StatusMessage feedback={listFeedback} className="mb-4" />
            {currentNews.length > 0 ? (
              <ul className="space-y-3">{currentNews.map((item) => renderNewsCard(item))}</ul>
            ) : (
              <EmptyState>
                {archivedNews.length > 0
                  ? "Aucune actualité récente. Les actualités de plus d’un mois sont dans les archives ci-dessous."
                  : "Aucune actualité pour le moment. Cliquez sur « Ajouter une actualité » pour publier la première."}
              </EmptyState>
            )}
          </SectionCard>

          {archivedNews.length > 0 ? (
            <Collapsible
              title="Archives"
              description="Actualités de plus d’un mois"
              badge={<Badge tone="slate">{archivedNews.length}</Badge>}
              open={showArchives}
              onOpenChange={setShowArchives}
            >
              <ul className="space-y-3">{archivedNews.map((item) => renderNewsCard(item))}</ul>
            </Collapsible>
          ) : null}

          {orphanPolls.length > 0 ? (
            <Collapsible
              title="Nettoyage"
              description="Sondages qui ne sont rattachés à aucune actualité"
              badge={<Badge tone="orange">{orphanPolls.length}</Badge>}
              open={showCleanup}
              onOpenChange={setShowCleanup}
            >
              <p className="text-sm leading-6 text-slate-700">
                Ces sondages restent visibles seuls sur le site. Supprimez ceux dont vous n’avez plus besoin.
              </p>
              <ul className="mt-3 space-y-2">
                {orphanPolls.map((poll) => (
                  <li
                    key={poll.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-line bg-brand-cream/50 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-break block text-sm font-semibold text-slate-900">{poll.question}</span>
                      <span className="block text-sm text-slate-600">{voteLabel(pollVoteTotal(poll))}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "delete-orphan", poll })}
                      disabled={saving}
                      className="btn btn-ghost btn-sm border-rose-200 text-rose-700 hover:bg-rose-50"
                      aria-label={`Supprimer le sondage « ${poll.question} »`}
                    >
                      Supprimer
                    </button>
                  </li>
                ))}
              </ul>
            </Collapsible>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirmLabel}
        cancelLabel={confirmCopy.cancelLabel}
        tone={confirmCopy.tone}
        busy={saving}
        onConfirm={() => void confirmAction()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
