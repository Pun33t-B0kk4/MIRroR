import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Thread } from "@/lib/types";

const memory = new Map<string, Thread>();

function filePath() {
  if (process.env.VERCEL) return path.join("/tmp", "mirror-threads.json");
  return path.join(process.cwd(), "data", "threads.json");
}

export function asThread(value: unknown): Thread | null {
  if (!value || typeof value !== "object") return null;
  const thread = value as Thread;
  if (typeof thread.id !== "string" || typeof thread.slug !== "string") return null;
  if (!thread.progress || typeof thread.progress.strikes !== "number") return null;
  if (!Array.isArray(thread.messages) || !Array.isArray(thread.mirrorMessages)) return null;
  return thread;
}

let chain: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function persistenceMode() {
  return database() ? "supabase" : "file";
}

async function readFileStore(): Promise<Thread[]> {
  const byId = new Map<string, Thread>();
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as { threads?: Thread[] };
    for (const thread of parsed.threads ?? []) {
      if (thread?.id) byId.set(thread.id, thread);
    }
  } catch (error) {
    console.error("Could not read saved chats:", error instanceof Error ? error.message : error);
  }
  for (const thread of memory.values()) byId.set(thread.id, thread);
  return [...byId.values()];
}

async function writeFileStore(threads: Thread[]) {
  for (const thread of threads) memory.set(thread.id, thread);
  const target = filePath();
  try {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({ threads }, null, 2), "utf8");
  } catch (error) {
    console.error("Could not write saved chats:", error instanceof Error ? error.message : error);
  }
}

async function readSupabase(client: SupabaseClient): Promise<Thread[]> {
  const { data, error } = await client
    .from("threads")
    .select("payload")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.payload as Thread);
}

async function writeSupabase(client: SupabaseClient, thread: Thread) {
  const { error } = await client.from("threads").upsert({
    id: thread.id,
    slug: thread.slug,
    payload: thread,
    updated_at: thread.updatedAt,
  });
  if (error) throw new Error(error.message);
}

async function readAll(): Promise<Thread[]> {
  const client = database();
  if (client) {
    try {
      const remote = await readSupabase(client);
      for (const thread of remote) memory.set(thread.id, thread);
    } catch (error) {
      console.error("Could not read hosted chats:", error instanceof Error ? error.message : error);
    }
  }
  return readFileStore();
}

async function keep(thread: Thread) {
  memory.set(thread.id, thread);
  const client = database();
  if (client) {
    try {
      await writeSupabase(client, thread);
      return;
    } catch (error) {
      console.error("Could not save the hosted chat:", error instanceof Error ? error.message : error);
    }
  }
  const threads = await readFileStore();
  const index = threads.findIndex((item) => item.id === thread.id);
  if (index < 0) threads.push(thread);
  else threads[index] = thread;
  await writeFileStore(threads);
}

export function listThreads() {
  return withLock(async () => {
    const threads = await readAll();
    return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
}

export function getThread(id: string) {
  return withLock(async () => {
    const threads = await readAll();
    return threads.find((thread) => thread.id === id) ?? null;
  });
}

export function createThread(thread: Thread) {
  return withLock(async () => {
    await keep(thread);
    return thread;
  });
}

export function saveThread(thread: Thread) {
  return withLock(async () => {
    thread.updatedAt = new Date().toISOString();
    await keep(thread);
    return thread;
  });
}
