import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { getUserId } from "../middleware/auth.js";

export function creditsRoutes(db: Database): Hono {
  const router = new Hono();

  // GET /api/credits/balance — return current user's credit balance
  router.get("/balance", async (c) => {
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

    const user = db
      .query("SELECT id, email, credits FROM users WHERE id = ?")
      .get(userId) as { id: string; email: string; credits: number } | undefined;

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ credits: user.credits });
  });

  // POST /api/credits/add — add credits to a user (auth required)
  router.post("/add", async (c) => {
    // Auth check — must be logged in
    const cookie = c.req.header("cookie") || "";
    const match = cookie.match(/session=([^;]+)/);
    const token = match ? match[1] : null;

    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const authUserId = getUserId(token);
    if (!authUserId) {
      return c.json({ error: "Session expired" }, 401);
    }

    // Parse and validate body
    let body: { userId?: string; amount?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { userId, amount } = body;

    if (!userId || typeof userId !== "string") {
      return c.json({ error: "userId (string) is required" }, 400);
    }

    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      return c.json({ error: "amount must be a positive integer" }, 400);
    }

    // Verify the target user exists
    const targetUser = db
      .query("SELECT id, credits FROM users WHERE id = ?")
      .get(userId) as { id: string; credits: number } | undefined;

    if (!targetUser) {
      return c.json({ error: "Target user not found" }, 404);
    }

    // Update credits
    db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [
      amount,
      userId,
    ]);

    // Fetch updated balance
    const updated = db
      .query("SELECT id, email, credits FROM users WHERE id = ?")
      .get(userId) as { id: string; email: string; credits: number };

    return c.json({
      success: true,
      userId: updated.id,
      credits: updated.credits,
      added: amount,
    });
  });

  return router;
}
