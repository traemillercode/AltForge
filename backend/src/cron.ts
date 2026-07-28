import type { Database } from "bun:sqlite";
import { sendEmail } from "./email.js";

const DRIP_TYPES = {
  DAY2_NUDGE: "day2_nudge",
  DAY5_RECAP: "day5_recap",
  DAY14_CASESTUDY: "day14_casestudy",
  DAY30_REENGAGEMENT: "day30_reengagement",
} as const;

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Every hour
const WINDOW_MINUTES = 30; // ±30 min tolerance window

/**
 * Check if a drip email has already been sent to this user.
 */
function dripAlreadySent(
  db: Database,
  userId: string,
  dripType: string
): boolean {
  const row = db
    .query("SELECT id FROM drip_emails WHERE user_id = ? AND drip_type = ?")
    .get(userId, dripType);
  return !!row;
}

/**
 * Record a sent drip email.
 */
function recordDripSent(
  db: Database,
  userId: string,
  dripType: string
): void {
  db.run(
    "INSERT INTO drip_emails (id, user_id, drip_type, sent_at) VALUES (?, ?, ?, datetime('now'))",
    [crypto.randomUUID(), userId, dripType]
  );
}

/**
 * Day 2 nudge: users who signed up ~48 hours ago but haven't created any jobs.
 */
async function sendDay2Nudge(db: Database): Promise<void> {
  const windowSec = WINDOW_MINUTES * 60;
  const targetSec = 48 * 3600;

  const users = db
    .query(
      `SELECT u.id, u.email
       FROM users u
       WHERE u.created_at >= datetime('now', '-' || ? || ' seconds')
         AND u.created_at <= datetime('now', '-' || ? || ' seconds')
         AND NOT EXISTS (
           SELECT 1 FROM jobs j WHERE j.user_id = u.id
         )
       ORDER BY u.created_at`
    )
    .all(targetSec + windowSec, targetSec - windowSec) as { id: string; email: string }[];

  for (const user of users) {
    if (dripAlreadySent(db, user.id, DRIP_TYPES.DAY2_NUDGE)) continue;

    await sendEmail(
      user.email,
      "Getting started with AltForge — try your first batch free",
      `<h1>Getting started with AltForge</h1>
<p>Hi there! You signed up for AltForge a couple of days ago, but haven't processed any images yet.</p>
<p>With your <strong>25 free credits</strong>, you can generate WCAG-compliant alt-text for up to 25 images — no setup required.</p>
<p><a href="https://altforge.app/dashboard">Go to your dashboard</a> to upload a CSV of image URLs, crawl a website, or drop images directly.</p>
<p>— The AltForge team</p>`
    );

    recordDripSent(db, user.id, DRIP_TYPES.DAY2_NUDGE);
    console.log(`[cron] Day 2 nudge sent to ${user.email}`);
  }
}

/**
 * Day 5 usage recap: users who signed up ~5 days ago and have at least 1 job.
 */
async function sendDay5Recap(db: Database): Promise<void> {
  const windowSec = WINDOW_MINUTES * 60;
  const targetSec = 5 * 24 * 3600;

  const users = db
    .query(
      `SELECT u.id, u.email,
         (SELECT COUNT(*) FROM jobs j WHERE j.user_id = u.id) as job_count,
         (SELECT COALESCE(SUM(j2.total_images), 0) FROM jobs j2 WHERE j2.user_id = u.id) as total_images
       FROM users u
       WHERE u.created_at >= datetime('now', '-' || ? || ' seconds')
         AND u.created_at <= datetime('now', '-' || ? || ' seconds')
         AND EXISTS (
           SELECT 1 FROM jobs j3 WHERE j3.user_id = u.id
         )
       ORDER BY u.created_at`
    )
    .all(targetSec + windowSec, targetSec - windowSec) as {
    id: string;
    email: string;
    job_count: number;
    total_images: number;
  }[];

  for (const user of users) {
    if (dripAlreadySent(db, user.id, DRIP_TYPES.DAY5_RECAP)) continue;

    await sendEmail(
      user.email,
      "Your AltForge recap — images processed this week",
      `<h1>Your AltForge weekly recap</h1>
<p>Here's a quick look at your first week with AltForge:</p>
<ul>
  <li><strong>${user.job_count}</strong> job${user.job_count !== 1 ? "s" : ""} created</li>
  <li><strong>${user.total_images}</strong> image${user.total_images !== 1 ? "s" : ""} processed</li>
</ul>
<p>Keep the momentum going! <a href="https://altforge.app/dashboard">Process another batch</a> and keep building accessible content.</p>
<p>— The AltForge team</p>`
    );

    recordDripSent(db, user.id, DRIP_TYPES.DAY5_RECAP);
    console.log(`[cron] Day 5 recap sent to ${user.email}`);
  }
}

/**
 * Day 14 case study: all users who signed up ~14 days ago.
 */
async function sendDay14CaseStudy(db: Database): Promise<void> {
  const windowSec = WINDOW_MINUTES * 60;
  const targetSec = 14 * 24 * 3600;

  const users = db
    .query(
      `SELECT u.id, u.email
       FROM users u
       WHERE u.created_at >= datetime('now', '-' || ? || ' seconds')
         AND u.created_at <= datetime('now', '-' || ? || ' seconds')
       ORDER BY u.created_at`
    )
    .all(targetSec + windowSec, targetSec - windowSec) as { id: string; email: string }[];

  for (const user of users) {
    if (dripAlreadySent(db, user.id, DRIP_TYPES.DAY14_CASESTUDY)) continue;

    await sendEmail(
      user.email,
      "How accessibility teams use AltForge to cut audit time by 80%",
      `<h1>Case study: How accessibility teams use AltForge</h1>
<p>Manual alt-text writing is one of the biggest time sinks in web accessibility audits. Here's how teams are using AltForge to ship faster:</p>
<h2>Before AltForge:</h2>
<ul>
  <li>Average 30–60 seconds per image writing alt-text manually</li>
  <li>Inconsistent quality across team members</li>
  <li>Auditors spending hours on repetitive tasks</li>
</ul>
<h2>After AltForge:</h2>
<ul>
  <li><strong>80% time savings</strong> — AI generates compliant alt-text in bulk</li>
  <li>Inline editing for human review and refinement</li>
  <li>Export as CSV or ready-to-paste HTML snippets</li>
</ul>
<p><a href="https://altforge.app/dashboard">Process your next batch</a> and see the difference yourself.</p>
<p>— The AltForge team</p>`
    );

    recordDripSent(db, user.id, DRIP_TYPES.DAY14_CASESTUDY);
    console.log(`[cron] Day 14 case study sent to ${user.email}`);
  }
}

/**
 * Day 30 re-engagement: users who signed up ~30 days ago with no activity in the last 14 days.
 * Grants 10 free credits as an incentive.
 */
async function sendDay30Reengagement(db: Database): Promise<void> {
  const windowSec = WINDOW_MINUTES * 60;
  const targetSec = 30 * 24 * 3600;

  const users = db
    .query(
      `SELECT u.id, u.email
       FROM users u
       WHERE u.created_at >= datetime('now', '-' || ? || ' seconds')
         AND u.created_at <= datetime('now', '-' || ? || ' seconds')
         AND NOT EXISTS (
           SELECT 1 FROM jobs j
           WHERE j.user_id = u.id
             AND j.created_at >= datetime('now', '-14 days')
         )
       ORDER BY u.created_at`
    )
    .all(targetSec + windowSec, targetSec - windowSec) as { id: string; email: string }[];

  for (const user of users) {
    if (dripAlreadySent(db, user.id, DRIP_TYPES.DAY30_REENGAGEMENT)) continue;

    await sendEmail(
      user.email,
      "We miss you — here's 10 free credits to come back",
      `<h1>We miss you at AltForge</h1>
<p>It's been a while since you last processed images with AltForge. We've added <strong>10 free credits</strong> to your account — come back and give it another try!</p>
<p>Your credits are ready in your dashboard. <a href="https://altforge.app/dashboard">Pick up where you left off</a> or start something new.</p>
<p>— The AltForge team</p>`
    );

    // Grant 10 credits
    db.run("UPDATE users SET credits = credits + 10 WHERE id = ?", [user.id]);

    recordDripSent(db, user.id, DRIP_TYPES.DAY30_REENGAGEMENT);
    console.log(`[cron] Day 30 re-engagement sent to ${user.email} (+10 credits)`);
  }
}

/**
 * Run all drip checks. Called on an interval — fails silently per-drip.
 */
async function runDripChecks(db: Database): Promise<void> {
  console.log("[cron] Running drip checks...");
  try {
    await sendDay2Nudge(db);
  } catch (err) {
    console.error("[cron] Day 2 nudge error:", err);
  }
  try {
    await sendDay5Recap(db);
  } catch (err) {
    console.error("[cron] Day 5 recap error:", err);
  }
  try {
    await sendDay14CaseStudy(db);
  } catch (err) {
    console.error("[cron] Day 14 case study error:", err);
  }
  try {
    await sendDay30Reengagement(db);
  } catch (err) {
    console.error("[cron] Day 30 re-engagement error:", err);
  }
  console.log("[cron] Drip checks complete");
}

/**
 * Start background cron jobs. Non-blocking — uses setInterval.
 */
export function startCronJobs(db: Database): void {
  console.log("[cron] Starting drip email scheduler (checks every hour)");

  // Run immediately on startup, then on interval
  runDripChecks(db);

  setInterval(() => {
    runDripChecks(db);
  }, CHECK_INTERVAL_MS);
}
