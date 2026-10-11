import { z } from "zod";

export const createThreadBody = z.object({
  slug: z.string().trim().min(1).max(80),
});

export const turnBody = z.object({
  threadId: z.uuid(),
  text: z.string().trim().min(1).max(2000),
  mode: z.enum(["talk", "mirror"]),
  thread: z.unknown().optional(),
});

export const threadIdBody = z.object({
  threadId: z.uuid(),
  thread: z.unknown().optional(),
});

export const actBody = z.object({
  threadId: z.uuid(),
  act: z.enum(["mirror", "review"]),
  thread: z.unknown().optional(),
});

export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError("The request body was not valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(issue?.message ?? "That request could not be read.");
  }
  return parsed.data;
}
