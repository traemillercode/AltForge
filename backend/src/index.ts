import { Hono } from "hono";
import { cors } from "hono/cors";
import { initDatabase } from "./db/index.js";
import { authRoutes } from "./routes/auth.js";

const app = new Hono();

// CORS for frontend dev server
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
app.use("/*", cors({
  origin: [frontendUrl, "http://localhost:3000"],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Cookie"],
}));

// Initialize database
const db = initDatabase();

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Auth routes
app.route("/api/auth", authRoutes(db));

// Protected dashboard endpoint
app.get("/api/dashboard", async (c) => {
  const cookie = c.req.header("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { getUserId } = await import("./middleware/auth.js");
  const userId = getUserId(token);
  if (!userId) {
    return c.json({ error: "Session expired" }, 401);
  }

  const user = db.query("SELECT id, email, credits FROM users WHERE id = ?")
    .get(userId) as { id: string; email: string; credits: number } | undefined;

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ user });
});

const port = parseInt(process.env.PORT || "3000");
console.log(`🚀 AltForge API running on http://localhost:${port}`);

Bun.serve({
  port,
  fetch: app.fetch,
});
