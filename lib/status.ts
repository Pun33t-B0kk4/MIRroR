import type { Thread } from "@/lib/types";

export function showingLabel(thread?: Thread) {
  if (!thread) return "";
  if (thread.progress.outcome === "resolved") return "Trophy earned";
  if (thread.progress.outcome === "cooldown") return "Cooldown";
  if (thread.messages.some((message) => message.role === "user")) return "In progress";
  return "";
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: T & { error?: string };
  try {
    data = (await response.json()) as T & { error?: string };
  } catch {
    throw new Error("The chat could not start. Try that person again.");
  }
  if (!response.ok) {
    throw new Error(data.error || "The rehearsal could not do that.");
  }
  return data;
}
