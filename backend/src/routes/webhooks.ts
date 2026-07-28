import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { createHmac, timingSafeEqual } from "node:crypto";

// Price ID → credits mapping
const PRICE_CREDITS: Record<string, number> = {
  "price_1Ty5PZD69eofb6Tp0Tq8Chm9": 250,   // Starter ($19 one-time)
  "price_1Ty5PZD69eofb6TpZ4xGmLpJ": 1000,  // Growth ($49 one-time)
  "price_1TyEE0D69eofb6Tp34FIbpSj": 1500,  // Pro ($39/mo subscription)
};

// Amount in cents → credits (derived from PRICE_CREDITS)
const AMOUNT_CREDITS: Record<number, number> = {
  1900: 250,   // Starter
  4900: 1000,  // Growth
  3900: 1500,  // Pro (monthly)
};

function getCreditsForAmount(amountTotal: number): number {
  return AMOUNT_CREDITS[amountTotal] || 0;
}

function getCreditsForPriceId(priceId: string): number {
  return PRICE_CREDITS[priceId] || 0;
}

/**
 * Verify a Stripe webhook signature manually using HMAC-SHA256.
 * No Stripe SDK required.
 */
function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  // Parse header: "t=TIMESTAMP,v1=SIG1,v1=SIG2,..."
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx);
    const value = part.slice(eqIdx + 1);
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Reject events older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    console.warn("[webhook] Timestamp outside tolerance window", { timestamp, now });
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSig = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  // Timing-safe comparison against all provided signatures
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  for (const sig of signatures) {
    if (sig.length !== expectedSig.length) continue;
    const sigBuf = Buffer.from(sig, "utf8");
    if (timingSafeEqual(sigBuf, expectedBuf)) return true;
  }

  return false;
}

export function webhookRoutes(db: Database): Hono {
  const router = new Hono();

  // POST /api/webhooks/stripe
  // IMPORTANT: Must receive the raw body for signature verification.
  // We use c.req.text() to get the raw unparsed body.
  router.post("/stripe", async (c) => {
    const signature = c.req.header("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.error("[webhook] STRIPE_WEBHOOK_SECRET not configured");
      return c.json({ error: "Webhook not configured" }, 500);
    }

    if (!signature) {
      console.warn("[webhook] Missing stripe-signature header");
      return c.json({ error: "Missing signature" }, 400);
    }

    // Read the raw body as text (not parsed as JSON)
    let rawBody: string;
    try {
      rawBody = await c.req.text();
    } catch (err) {
      console.error("[webhook] Failed to read request body:", err);
      return c.json({ error: "Failed to read body" }, 400);
    }

    // Verify the webhook signature
    if (!verifyStripeSignature(rawBody, signature, secret)) {
      console.warn("[webhook] Signature verification failed");
      return c.json({ error: "Invalid signature" }, 403);
    }

    // Parse the Stripe event JSON
    let event: { type: string; data: { object: Record<string, unknown> } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    console.log(`[webhook] Received event: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object, db);
          break;
        case "invoice.paid":
          await handleInvoicePaid(event.data.object, db);
          break;
        default:
          // Acknowledge all other event types silently
          console.log(`[webhook] Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      console.error(`[webhook] Error processing ${event.type}:`, err);
      // Still return 200 to prevent Stripe from retrying
    }

    return c.json({ received: true });
  });

  return router;
}

async function handleCheckoutSessionCompleted(
  obj: Record<string, unknown>,
  db: Database
): Promise<void> {
  const sessionId = obj.id as string | undefined;
  const clientReferenceId = obj.client_reference_id as string | null | undefined;
  const customer = obj.customer as string | null | undefined;
  const mode = obj.mode as string | undefined; // "payment" | "subscription" | "setup"
  const amountTotal = obj.amount_total as number | undefined; // in cents
  const subscription = obj.subscription as string | null | undefined;

  console.log(
    `[webhook] checkout.session.completed: id=${sessionId}, ` +
    `user=${clientReferenceId}, mode=${mode}, amount=${amountTotal}`
  );

  // Must have a user reference
  if (!clientReferenceId) {
    console.warn("[webhook] No client_reference_id on session — cannot credit");
    return;
  }

  // Determine credits to add
  let creditsToAdd = 0;

  if (mode === "subscription") {
    creditsToAdd = getCreditsForAmount(3900); // Pro plan: $39.00
  } else if (amountTotal) {
    creditsToAdd = getCreditsForAmount(amountTotal);
  }

  if (creditsToAdd === 0) {
    console.warn(
      `[webhook] Cannot determine credits for session ${sessionId}. ` +
      `mode=${mode}, amount_total=${amountTotal}`
    );
    return;
  }

  // Store the Stripe customer ID on the user record for subscription management
  if (customer) {
    db.run("UPDATE users SET stripe_customer_id = ? WHERE id = ?", [
      customer,
      clientReferenceId,
    ]);
  }

  // Add credits
  await addCredits(
    db,
    clientReferenceId,
    creditsToAdd,
    `session_${sessionId}`,
    mode === "subscription" ? "subscription_initial" : "one_time_purchase"
  );

  // If this is a subscription, also log the subscription ID for renewal tracking
  if (subscription) {
    db.run(
      `INSERT INTO transactions (user_id, stripe_reference, amount, reason, created_at)
       VALUES (?, ?, 0, 'subscription_created', datetime('now'))`,
      [clientReferenceId, `sub_${subscription}`]
    );
  }
}

async function handleInvoicePaid(
  obj: Record<string, unknown>,
  db: Database
): Promise<void> {
  const invoiceId = obj.id as string | undefined;
  const customer = obj.customer as string | null | undefined;
  const subscription = obj.subscription as string | null | undefined;

  console.log(
    `[webhook] invoice.paid: invoice=${invoiceId}, ` +
    `customer=${customer}, subscription=${subscription}`
  );

  if (!customer) {
    console.warn("[webhook] No customer on invoice — cannot credit");
    return;
  }

  // Look up the user by Stripe customer ID
  const user = db
    .query("SELECT id FROM users WHERE stripe_customer_id = ?")
    .get(customer) as { id: string } | undefined;

  if (!user) {
    console.warn(`[webhook] No user found for Stripe customer ${customer}`);
    return;
  }

  // Check if this invoice has already been processed (prevent double-crediting)
  const existing = db
    .query(
      "SELECT id FROM transactions WHERE stripe_reference = ? AND reason = 'subscription_renewal'"
    )
    .get(`invoice_${invoiceId}`);

  if (existing) {
    console.log(`[webhook] Invoice ${invoiceId} already processed — skipping`);
    return;
  }

  // Determine credits from line items (price ID) or fall back to subscription default
  let creditsToAdd = 1500; // Default for subscription renewal

  const lines = obj.lines as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const lineData = lines?.data;
  if (lineData && lineData.length > 0 && lineData[0]?.price?.id) {
    const priceIdCredits = getCreditsForPriceId(lineData[0].price.id);
    if (priceIdCredits > 0) {
      creditsToAdd = priceIdCredits;
    }
  }

  // Add credits for subscription renewal
  await addCredits(db, user.id, creditsToAdd, `invoice_${invoiceId}`, "subscription_renewal");
}

async function addCredits(
  db: Database,
  userId: string,
  amount: number,
  reference: string,
  reason: string
): Promise<void> {
  // Check for duplicate transaction (idempotency)
  const existing = db
    .query(
      "SELECT id FROM transactions WHERE stripe_reference = ? AND reason = ?"
    )
    .get(reference, reason);

  if (existing) {
    console.log(
      `[webhook] Duplicate transaction: ref=${reference}, reason=${reason} — skipping`
    );
    return;
  }

  // Verify user exists
  const user = db
    .query("SELECT id, credits FROM users WHERE id = ?")
    .get(userId) as { id: string; credits: number } | undefined;

  if (!user) {
    console.warn(`[webhook] User not found: ${userId}`);
    return;
  }

  // Update credits
  db.run("UPDATE users SET credits = credits + ? WHERE id = ?", [amount, userId]);

  // Log the transaction
  db.run(
    `INSERT INTO transactions (user_id, stripe_reference, amount, reason, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [userId, reference, amount, reason]
  );

  const newBalance = user.credits + amount;
  console.log(
    `[webhook] Credited ${amount} credits to user ${userId} (${reason}). ` +
    `Balance: ${user.credits} → ${newBalance}`
  );
}
