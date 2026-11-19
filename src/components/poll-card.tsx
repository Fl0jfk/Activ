"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { SitePoll } from "@/lib/site-data-types";
import { POLL_VOTES_STORAGE_KEY, pollVoteTotal } from "@/lib/site-polls";

const VOTES_CHANGED_EVENT = "activ:poll-votes-changed";

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

function subscribeToVotes(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VOTES_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VOTES_CHANGED_EVENT, onChange);
  };
}

export default function PollCard({ poll: initialPoll }: { poll: SitePoll }) {
  const [poll, setPoll] = useState(initialPoll);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const votedOptionId = useSyncExternalStore(
    subscribeToVotes,
    () => readStoredVotes()[poll.id] ?? "",
    () => "",
  );
  const selected = votedOptionId || picked;
  const closed = poll.status === "closed";
  const showResults = closed || Boolean(votedOptionId);
  const total = useMemo(() => pollVoteTotal(poll), [poll]);

  function rememberVote(optionId: string) {
    const nextVotes = { ...readStoredVotes(), [poll.id]: optionId };
    window.localStorage.setItem(POLL_VOTES_STORAGE_KEY, JSON.stringify(nextVotes));
    window.dispatchEvent(new Event(VOTES_CHANGED_EVENT));
  }

  async function vote() {
    if (!selected) {
      setMessage("Choisissez une réponse avant de voter.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: selected }),
      });
      const payload = (await response.json()) as { message?: string; poll?: SitePoll };
      if (response.ok && payload.poll) {
        setPoll(payload.poll);
        rememberVote(selected);
        setMessage("Merci, votre vote est enregistré.");
      } else if (response.status === 409) {
        rememberVote(selected);
        setMessage("Vous avez déjà voté à ce sondage.");
      } else {
        setMessage(payload.message ?? "Impossible d'enregistrer le vote.");
      }
    } catch {
      setMessage("Impossible d'enregistrer le vote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Sondage</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-bold text-slate-900">{poll.question}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            closed ? "bg-slate-200 text-slate-700" : "bg-violet-100 text-violet-800"
          }`}
        >
          {closed ? "Terminé" : "En cours"}
        </span>
      </div>
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
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name={poll.id}
                    value={option.id}
                    checked={isChoice}
                    onChange={() => setPicked(option.id)}
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
          className="mt-4 rounded-full bg-violet-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Voter"}
        </button>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          {total} vote{total > 1 ? "s" : ""}
        </p>
      )}
      {message ? <p className="mt-2 text-sm text-slate-700">{message}</p> : null}
    </article>
  );
}
