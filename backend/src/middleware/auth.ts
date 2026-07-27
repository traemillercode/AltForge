import type { Context, Next } from "hono";

// In-memory session store (MVP — restart clears sessions)
const sessions = new Map<string, { userId: string; createdAt: number }>();

// Clean expired sessions every 15 minutes
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(token);
    }
  }
}, 15 * 60 * 1000);

export function createSession(userId: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export function getUserId(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
}

export async function authMiddleware(c: Context, next: Next) {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = getUserId(token);
  if (!userId) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("userId", userId);
  c.set("sessionToken", token);
  await next();
}
