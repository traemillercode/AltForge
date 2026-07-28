import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { initDatabase } from "./db/index.js";
import { authRoutes } from "./routes/auth.js";
import { jobsRoutes } from "./routes/jobs.js";
import { creditsRoutes } from "./routes/credits.js";
import { sampleRoutes } from "./routes/sample.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { startCronJobs } from "./cron.js";

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

// Start drip email cron jobs (non-blocking)
startCronJobs(db);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Auth routes
app.route("/api/auth", authRoutes(db));

// Job routes (all protected)
app.route("/api/jobs", jobsRoutes(db));

// Credit routes (auth required)
app.route("/api/credits", creditsRoutes(db));

// Sample route (no auth, rate-limited)
app.route("/api/sample", sampleRoutes());

// Webhook routes (Stripe — raw body, no auth)
app.route("/api/webhooks", webhookRoutes(db));

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

  // Count user's jobs for dashboard
  const jobCount = db.query(
    "SELECT COUNT(*) as count FROM jobs WHERE user_id = ?"
  ).get(userId) as { count: number };

  return c.json({ user, jobCount: jobCount.count });
});

// In production, serve the built frontend
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  const frontendDist = new URL("../../frontend/dist", import.meta.url).pathname;
  
  // Serve static assets (JS, CSS, images, etc.)
  app.use("/assets/*", serveStatic({ root: frontendDist }));
  app.use("/*.svg", serveStatic({ root: frontendDist }));
  app.use("/*.png", serveStatic({ root: frontendDist }));
  app.use("/*.ico", serveStatic({ root: frontendDist }));
  
  // For SPA routing, serve index.html for all non-API, non-asset routes
  app.get("/*", serveStatic({ 
    root: frontendDist,
    rewriteRequestPath: () => "/index.html",
  }));
  
  console.log(`📦 Serving frontend from ${frontendDist}`);
}

const port = parseInt(process.env.PORT || "3000");
console.log(`🚀 AltForge API running on http://localhost:${port}`);

Bun.serve({
  port,
  fetch: app.fetch,
});
