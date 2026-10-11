"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Feedback, ResponseFeedback } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Role-reversal review. Required: the end-of-scenario actions (try again, the
 * optional mirror chair, pick another friend) only appear once the user has
 * stepped through every response.
 */
export function FeedbackView({
  feedback,
  name,
  actions,
}: {
  feedback: Feedback;
  name: string;
  actions: ReactNode;
}) {
  const [shown, setShown] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const total = feedback.responses.length;
  const done = shown >= total;

  useEffect(() => {
    if (shown === 0) return;
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown]);

  return (
    <div className="flex flex-col gap-4">
      <section className="bubble-in rounded-3xl border border-border bg-card p-5 text-foreground">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">From {name}&apos;s side</p>
        <p className="mt-2 text-base leading-7">{feedback.summary}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Points title="What worked" items={feedback.pros} tone="pro" />
          <Points title="What to work on" items={feedback.cons} tone="con" />
        </div>
      </section>

      {feedback.responses.slice(0, shown).map((item, index) => (
        <section key={item.messageId} className="bubble-in rounded-3xl border border-border bg-card p-5 text-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Response {index + 1} of {total}
            </p>
            <ResultChip item={item} />
          </div>
          <blockquote className="mt-2 rounded-2xl bg-accent/25 px-4 py-3 text-base leading-7">“{item.text}”</blockquote>
          {item.reply ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">{name}:</span> {item.reply}
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Points title="Pros" items={item.pros} tone="pro" />
            <Points title="Cons" items={item.cons.length ? item.cons : ["Nothing major here."]} tone="con" />
          </div>
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm leading-6">
            <span className="font-medium">Try instead: </span>
            {item.tryInstead}
          </p>
        </section>
      ))}

      {done ? (
        actions
      ) : (
        <div className="flex justify-center">
          <Button type="button" variant="accent" size="lg" onClick={() => setShown((value) => value + 1)}>
            {shown === 0 ? "See your first response" : `Next: response ${shown + 1} of ${total}`}
          </Button>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

function Points({ title, items, tone }: { title: string; items: string[]; tone: "pro" | "con" }) {
  return (
    <div>
      <p className={tone === "pro" ? "text-sm font-medium text-moss" : "text-sm font-medium text-destructive"}>{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6">
            <span aria-hidden="true" className={tone === "pro" ? "text-moss" : "text-destructive"}>
              {tone === "pro" ? "+" : "–"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultChip({ item }: { item: ResponseFeedback }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[0.65rem] uppercase tracking-wide",
        item.result === "met" && "bg-moss text-white",
        item.result === "strike" && "bg-destructive text-white",
        item.result === "neutral" && "bg-secondary text-muted-foreground",
      )}
    >
      {item.tag}
    </span>
  );
}
