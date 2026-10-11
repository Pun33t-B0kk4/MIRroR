"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FeedbackView } from "@/components/feedback-view";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";
import { cooldownEndsAt, expressionFor, formatWait } from "@/lib/game";
import { scenes } from "@/lib/scenes";
import { postJson, showingLabel } from "@/lib/status";
import type { ScenePublic, Thread } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * The whole game lives here:
 *   home   → pick one of five friends, easiest to hardest
 *   talk   → conversation; strikes and criteria stay hidden
 *   review → trophy or cooldown card, then the required role-reversal review
 *   mirror → optional: answer as the friend while your own lines come back at you
 *
 * Saved conversations and the simulated 6-hour cooldown live in this browser
 * only (proof of concept, no accounts).
 */

const savedKey = "mirror-threads";
const skipKey = "mirror-cooldown-skips";

function readSaved(): Thread[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(savedKey) ?? "") as { threads?: Thread[] };
    return Array.isArray(parsed.threads) ? parsed.threads.filter((item) => item?.progress) : [];
  } catch {
    return [];
  }
}

function remember(thread: Thread) {
  try {
    const next = [thread, ...readSaved().filter((item) => item.id !== thread.id)].slice(0, 30);
    localStorage.setItem(savedKey, JSON.stringify({ threads: next }));
  } catch {
    // The chat still works for this visit if the browser blocks storage.
  }
}

function readSkips(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(skipKey) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function latestFor(threads: Thread[], slug: string) {
  return threads
    .filter((item) => item.slug === slug)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** Milliseconds left on a simulated cooldown, or 0 if the friend is available. */
function lockLeft(thread: Thread | undefined, skips: string[], clock: number) {
  if (!thread || thread.progress.outcome !== "cooldown" || skips.includes(thread.id)) return 0;
  return Math.max(0, cooldownEndsAt(thread.endedAt) - clock);
}

export function ChatApp() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [skips, setSkips] = useState<string[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [boop, setBoop] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const triedReview = useRef<string | null>(null);
  const scene = thread ? scenes.find((item) => item.slug === thread.slug) ?? null : null;

  useEffect(() => {
    setThreads(readSaved());
    setSkips(readSkips());
  }, [thread?.updatedAt]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [thread?.messages.length, thread?.mirrorMessages.length, thread?.act, busy, reviewing]);

  useEffect(() => {
    const home = () => {
      setThread(null);
      setOpening(null);
      setError("");
    };
    window.addEventListener("mirror-home", home);
    return () => window.removeEventListener("mirror-home", home);
  }, []);

  function keep(next: Thread) {
    remember(next);
    setThread(next);
    setBoop((value) => value + 1);
  }

  async function run(task: () => Promise<{ thread: Thread }>) {
    setBusy(true);
    setError("");
    try {
      const data = await task();
      keep(data.thread);
      return data.thread;
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "That message didn't land.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const askReview = useCallback(async (current: Thread) => {
    triedReview.current = current.id;
    setReviewing(true);
    setError("");
    try {
      const data = await postJson<{ thread: Thread }>("/api/feedback", { threadId: current.id, thread: current });
      remember(data.thread);
      setThread(data.thread);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "The review didn't load.");
    } finally {
      setReviewing(false);
    }
  }, []);

  // The review is required, so it starts on its own as soon as the conversation ends.
  useEffect(() => {
    if (!thread || thread.progress.outcome === "open" || thread.feedback) return;
    if (busy || reviewing || triedReview.current === thread.id) return;
    void askReview(thread);
  }, [thread, busy, reviewing, askReview]);

  async function startNew(slug: string) {
    setOpening(slug);
    setThread(null);
    setError("");
    setDraft("");
    setBusy(true);
    try {
      const data = await postJson<{ thread: Thread }>("/api/threads", { slug });
      keep(data.thread);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Could not start the chat.");
    } finally {
      setBusy(false);
      setOpening(null);
    }
  }

  function openFriend(slug: string) {
    // Reopen the latest attempt (in progress, or its review); otherwise start one.
    const saved = latestFor(threads, slug);
    setError("");
    setDraft("");
    if (saved) {
      triedReview.current = null;
      setThread(saved);
      return;
    }
    void startNew(slug);
  }

  function skipCooldown(id: string) {
    const next = [...new Set([...readSkips(), id])];
    try {
      localStorage.setItem(skipKey, JSON.stringify(next));
    } catch {
      // Skipping still works for this visit.
    }
    setSkips(next);
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!thread || !draft.trim() || busy) return;
    const text = draft.trim();
    const mode = thread.act === "mirror" ? "mirror" : "talk";
    setDraft("");
    await run(() => postJson("/api/turn", { threadId: thread.id, text, mode, thread }));
    box.current?.focus();
  }

  const home = () => {
    setThread(null);
    setError("");
  };

  if (!thread || !scene) {
    return (
      <main className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 pb-16">
          <p className="text-sm text-muted-foreground">
            You made a joke at a party that hurt a friend. Now they want to talk. They get harder to win back as you go.
          </p>
          <ul className="mt-4 grid gap-3">
            {[...scenes]
              .sort((a, b) => a.level - b.level)
              .map((item, index) => {
                const saved = latestFor(threads, item.slug);
                const left = lockLeft(saved, skips, clock);
                const status = left ? `Cooldown · ${formatWait(left)}` : showingLabel(saved);
                return (
                  <li key={item.slug} className="bubble-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openFriend(item.slug)}
                      className="flex w-full items-center gap-3 rounded-3xl border border-border bg-card/85 p-3 text-left backdrop-blur-sm hover:bg-secondary disabled:opacity-70"
                    >
                      <Portrait
                        slug={item.slug}
                        name={item.character.name}
                        expression={saved ? expressionFor(saved.progress) : "guarded"}
                        className="h-16 w-14 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {item.character.name}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Level {item.level} · {item.forgiveness}
                            </span>
                          </span>
                          {status ? (
                            <span className="shrink-0 text-[0.65rem] uppercase tracking-wide text-muted-foreground">{status}</span>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.logline}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          {opening ? <p className="mt-3 text-sm text-muted-foreground">Opening the chat…</p> : null}
        </div>
      </main>
    );
  }

  const mirror = thread.act === "mirror";
  const ended = thread.progress.outcome !== "open";
  const transcript = mirror ? thread.mirrorMessages : thread.messages;
  const canType = !busy && (mirror || !ended);
  const left = lockLeft(thread, skips, clock);
  const stageLabel = mirror ? "Their chair" : ended ? "Review" : "Talk";

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col px-3 py-3 sm:px-4">
      <p className="sr-only" aria-live="polite">
        {busy ? `${mirror ? "You, from the other chair," : scene.character.name} is typing` : reviewing ? "Reviewing your responses" : ""}
      </p>
      <header className="flex items-center gap-3 rounded-3xl border border-border bg-card px-3 py-2">
        <Portrait
          key={boop}
          slug={scene.slug}
          name={scene.character.name}
          expression={expressionFor(thread.progress)}
          mirrored={mirror}
          className="portrait-pop h-12 w-11"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{mirror ? `${scene.character.name} (you)` : scene.character.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {mirror ? "Hearing your own voice from their side" : `Level ${scene.level} · ${scene.forgiveness}`}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2 py-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {stageLabel}
        </span>
      </header>

      <div
        ref={scroller}
        className={cn("stage-wash mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-[1.6rem] p-4", mirror && "mirror-sweep")}
        data-mood={expressionFor(thread.progress)}
        data-mode={mirror ? "mirror" : "scene"}
        tabIndex={0}
        aria-label="Conversation"
      >
        {!mirror ? <p className="bubble-in max-w-md text-sm leading-6 text-stage-foreground/75">{scene.premise}</p> : null}
        {transcript.map((message) => (
          <Bubble key={message.id} role={message.role} text={message.text} name={scene.character.name} mirror={mirror} />
        ))}
        {busy ? <Typing name={mirror ? "You, from the other chair" : scene.character.name} /> : null}

        {ended && !mirror ? (
          <>
            <ResultCard thread={thread} scene={scene} left={left} />
            {thread.feedback ? (
              <FeedbackView
                key={thread.id}
                feedback={thread.feedback}
                name={scene.character.name}
                actions={
                  <EndActions
                    scene={scene}
                    left={left}
                    busy={busy}
                    onMirror={() => void run(() => postJson("/api/act", { threadId: thread.id, act: "mirror", thread }))}
                    onAgain={() => void startNew(scene.slug)}
                    onSkip={() => skipCooldown(thread.id)}
                    onHome={home}
                  />
                }
              />
            ) : reviewing ? (
              <Typing name="MIRROR is reviewing your responses" />
            ) : error ? (
              <div className="flex justify-center">
                <Button type="button" variant="accent" onClick={() => void askReview(thread)}>
                  Load the review
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {mirror ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void run(() => postJson("/api/act", { threadId: thread.id, act: "review", thread }))}
          >
            Back to your review
          </Button>
        </div>
      ) : !ended ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={home}>
            Leave for now
          </Button>
        </div>
      ) : null}

      {canType ? (
        <form onSubmit={(event) => void send(event)} className="mt-3 flex items-end gap-2">
          <label className="sr-only" htmlFor="line">
            Message
          </label>
          <textarea
            id="line"
            ref={box}
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={mirror ? `Reply as ${scene.character.name}…` : `Message ${scene.character.name}…`}
            className="min-h-14 flex-1 resize-none rounded-3xl border border-border bg-card px-4 py-3 text-base outline-none"
          />
          <Button type="submit" variant="accent" disabled={!draft.trim()} className="h-12">
            Send
          </Button>
        </form>
      ) : null}
    </main>
  );
}

function ResultCard({ thread, scene, left }: { thread: Thread; scene: ScenePublic; left: number }) {
  const name = scene.character.name;
  if (thread.progress.outcome === "resolved") {
    const strikes = thread.progress.strikes;
    return (
      <section className="bubble-in rounded-3xl border border-moss/30 bg-moss p-6 text-center text-white">
        <p className="text-xs uppercase tracking-[0.18em] text-white/75">Scenario complete</p>
        <p className="mt-2 font-display text-3xl leading-tight">{scene.trophy.title}</p>
        {strikes ? (
          <p className="mt-1 text-sm text-white/80">
            {strikes} {strikes === 1 ? "strike" : "strikes"}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-white/90">
          Skill unlocked: <span className="font-medium">{scene.trophy.skill}</span>
        </p>
      </section>
    );
  }
  return (
    <section className="bubble-in rounded-3xl border border-border bg-card p-6 text-center text-foreground">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cooldown</p>
      <p className="mt-2 font-display text-2xl leading-tight">{name} needs some space.</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {left
          ? `You can try this conversation again in ${formatWait(left)}.`
          : "You can try this conversation again now."}{" "}
        While you wait, review what happened from {name}&apos;s side.
      </p>
    </section>
  );
}

function EndActions({
  scene,
  left,
  busy,
  onMirror,
  onAgain,
  onSkip,
  onHome,
}: {
  scene: ScenePublic;
  left: number;
  busy: boolean;
  onMirror: () => void;
  onAgain: () => void;
  onSkip: () => void;
  onHome: () => void;
}) {
  return (
    <section className="bubble-in rounded-3xl border border-border bg-card p-5 text-center text-foreground">
      <p className="text-sm leading-6 text-muted-foreground">
        Optional: sit in {scene.character.name}&apos;s chair and hear your own lines said back to you.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="moss" disabled={busy} onClick={onMirror}>
          Sit in their chair
        </Button>
        <Button type="button" variant="accent" disabled={busy || left > 0} onClick={onAgain}>
          {left ? `Try again in ${formatWait(left)}` : "Try again"}
        </Button>
        <Button type="button" variant="outline" onClick={onHome}>
          Pick another friend
        </Button>
      </div>
      {left ? (
        <button type="button" onClick={onSkip} className="mt-3 text-xs text-muted-foreground underline underline-offset-2">
          Skip cooldown (demo)
        </button>
      ) : null}
    </section>
  );
}

function Bubble({ role, text, name, mirror }: { role: string; text: string; name: string; mirror: boolean }) {
  if (role === "stage") {
    return <p className="bubble-in px-2 text-center text-sm italic text-stage-foreground/75">{text}</p>;
  }
  const mine = role === "user";
  const label = role === "mirror-self" ? "You, from the other chair" : mine && mirror ? `${name} (you)` : mine ? "You" : name;
  return (
    <div className={cn("bubble-in max-w-[85%]", mine ? "ml-auto" : "mr-auto")}>
      <p className="px-2 text-[0.65rem] uppercase tracking-[0.14em] text-stage-foreground/60">{label}</p>
      <p
        className={
          mine
            ? "mt-1 rounded-3xl rounded-br-md bg-accent px-4 py-3 text-accent-foreground"
            : "mt-1 rounded-3xl rounded-bl-md bg-white/10 px-4 py-3 text-stage-foreground"
        }
      >
        {text}
      </p>
    </div>
  );
}

function Typing({ name }: { name: string }) {
  return (
    <div className="mr-auto" aria-hidden="true">
      <p className="px-2 text-[0.65rem] uppercase tracking-[0.14em] text-stage-foreground/60">{name}</p>
      <p className="mt-1 flex w-16 gap-1 rounded-3xl bg-white/10 px-4 py-3">
        <span className="typing-dot size-2 rounded-full bg-stage-foreground" />
        <span className="typing-dot size-2 rounded-full bg-stage-foreground [animation-delay:150ms]" />
        <span className="typing-dot size-2 rounded-full bg-stage-foreground [animation-delay:300ms]" />
      </p>
    </div>
  );
}
