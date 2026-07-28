import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import type { UserRow } from "../types.js";
import { createSession, destroySession, getUserId } from "../middleware/auth.js";
import { sendEmail } from "../email.js";

export function authRoutes(db: Database): Hono {
  const router = new Hono();

  // POST /api/auth/signup
  router.post("/signup", async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = body as { email?: string; password?: string };

      // Validation
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return c.json({ error: "Valid email is required" }, 400);
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return c.json({ error: "Password must be at least 8 characters" }, 400);
      }

      // Check if user exists
      const existing = db.query("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim()) as { id: string } | undefined;
      if (existing) {
        return c.json({ error: "An account with this email already exists" }, 409);
      }

      // Hash password using Bun's built-in bcrypt
      const passwordHash = await Bun.password.hash(password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      db.run(
        "INSERT INTO users (id, email, password_hash, credits, created_at) VALUES (?, ?, ?, 25, ?)",
        [id, email.toLowerCase().trim(), passwordHash, now]
      );

      const token = createSession(id);

      // Send welcome email asynchronously (don't block response)
      sendEmail(
        email.toLowerCase().trim(),
        "Welcome to AltForge — start with your 25 free credits",
        `<h1>Welcome to AltForge!</h1>
<p>Your account is ready — you've got <strong>25 free credits</strong> to generate WCAG-compliant alt-text for your images.</p>
<h2>Getting started:</h2>
<ol>
  <li>Go to your <a href="https://altforge.app/dashboard">dashboard</a></li>
  <li>Upload a CSV of image URLs, crawl a website, or drop images directly</li>
  <li>Let AI generate alt-text for every image in seconds</li>
  <li>Review, edit, and export as CSV or ready-to-paste HTML</li>
</ol>
<p>Need more credits? Visit the <a href="https://altforge.app/pricing">pricing page</a>.</p>
<p>— The AltForge team</p>`
      ).catch((err) => {
        console.error("[auth] Welcome email failed:", err);
      });

      return new Response(JSON.stringify({
        user: { id, email: email.toLowerCase().trim(), credits: 25 },
      }), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
        },
      });
    } catch (err) {
      console.error("Signup error:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // POST /api/auth/login
  router.post("/login", async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = body as { email?: string; password?: string };

      if (!email || !password) {
        return c.json({ error: "Email and password are required" }, 400);
      }

      const user = db.query("SELECT id, email, password_hash, credits FROM users WHERE email = ?")
        .get(email.toLowerCase().trim()) as UserRow | undefined;

      if (!user) {
        return c.json({ error: "Invalid email or password" }, 401);
      }

      const valid = await Bun.password.verify(password, user.password_hash, "bcrypt");
      if (!valid) {
        return c.json({ error: "Invalid email or password" }, 401);
      }

      const token = createSession(user.id);

      return new Response(JSON.stringify({
        user: { id: user.id, email: user.email, credits: user.credits },
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // GET /api/auth/me
  router.get("/me", async (c) => {
    const cookie = c.req.header("cookie") || "";
    const match = cookie.match(/session=([^;]+)/);
    const token = match ? match[1] : null;

    if (!token) {
      return c.json({ error: "Not authenticated" }, 401);
    }

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

  // POST /api/auth/logout
  router.post("/logout", (c) => {
    const cookie = c.req.header("cookie") || "";
    const match = cookie.match(/session=([^;]+)/);
    const token = match ? match[1] : null;

    if (token) {
      destroySession(token);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      },
    });
  });

  return router;
}
