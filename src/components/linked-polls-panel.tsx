"use client";

import { useEffect, useMemo, useState } from "react";
import type { SitePoll } from "@/lib/site-data-types";
import { POLL_VOTES_STORAGE_KEY, pollVoteTotal } from "@/lib/site-polls";

type LinkedPollsPanelProps = {
  polls: SitePoll[];
};

function readStoredVotes(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(POLL_VOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export default function LinkedPollsPanel({ polls }: LinkedPollsPanelProps) {
  const [pollItems, setPollItems] = useState(polls);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setVotes(readStoredVotes());
  }, []);

  useEffect(() => {
    setPollItems(polls);
  }, [polls]);

  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-lg font-bold text-slate-900">Sondage lié à cette actualité</h2>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      {pollItems.map((poll) => (
        <article key={poll.id} className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase text-violet-800">Sondage</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-bold text-slate-900">{poll.question}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                poll.status === "closed" ? "bg-slate-200 text-slate-700" : "bg-violet-100 text-violet-800"
              }`}
            >
              {poll.status === "closed" ? "Terminé" : "En cours"}
            </span>
          </div>
          <PollOptions
            poll={poll}
            votedOptionId={votes[poll.id]}
            busy={busyPollId === poll.id}
            onBusy={(busy) => setBusyPollId(busy ? poll.id : null)}
            onMessage={setMessage}
            onVoted={(updatedPoll, optionId) => {
              setPollItems((current) => current.map((entry) => (entry.id === updatedPoll.id ? updatedPoll : entry)));
              const nextVotes = { ...votes, [poll.id]: optionId };
              setVotes(nextVotes);
              window.localStorage.setItem(POLL_VOTES_STORAGE_KEY, JSON.stringify(nextVotes));
            }}
          />
        </article>
      ))}
    </section>
  );
}

function PollOptions({
  poll,
  votedOptionId,
  busy,
  onBusy,
  onMessage,
  onVoted,
}: {
  poll: SitePoll;
  votedOptionId?: string;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onMessage: (message: string) => void;
  onVoted: (poll: SitePoll, optionId: string) => void;
}) {
  const [selected, setSelected] = useState(votedOptionId ?? "");
  const total = useMemo(() => pollVoteTotal(poll), [poll]);
  const closed = poll.status === "closed";
  const showResults = closed || Boolean(votedOptionId);

  useEffect(() => {
    if (votedOptionId) setSelected(votedOptionId);
  }, [votedOptionId]);

  async function vote() {
    if (!selected) {
      onMessage("Choisissez une réponse avant de voter.");
      return;
    }
    onBusy(true);
    onMessage("");
    const response = await fetch(`/api/polls/${poll.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: selected }),
    });
    const payload = (await response.json()) as { message?: string; poll?: SitePoll };
    if (response.ok && payload.poll) {
      onVoted(payload.poll, selected);
      onMessage("Merci, votre vote est enregistré.");
    } else if (response.status === 409) {
      onVoted(poll, selected);
      onMessage("Vous avez déjà voté à ce sondage.");
    } else {
      onMessage(payload.message ?? "Impossible d'enregistrer le vote.");
    }
    onBusy(false);
  }

  return (
    <>
      <ul className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const percent = total > 0 ? Math.round((option.votes / total) * 100) : 0;
          const isChoice = selected === option.id;
          return (
            <li key={option.id}>
              {showResults ? (
                <div>
                  <div className="flex justify-between text-sm text-slate-700">
                    <span className={isChoice ? "font-semibold" : ""}>
                      {option.label}
                      {isChoice ? " (votre vote)" : ""}
                    </span>
                    <span className="font-semibold">{percent} %</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-violet-100">
                    <div className="h-full rounded-full bg-violet-600" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name={poll.id}
                    value={option.id}
                    checked={isChoice}
                    onChange={() => setSelected(option.id)}
                    disabled={busy || closed}
                  />
                  {option.label}
                </label>
              )}
            </li>
          );
        })}
      </ul>
      {!closed && !votedOptionId ? (
        <button
          type="button"
          onClick={() => void vote()}
          disabled={busy}
          className="mt-4 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Voter"}
        </button>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          {total} vote{total > 1 ? "s" : ""}
        </p>
      )}
    </>
  );
}
