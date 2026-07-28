import { Resend } from "resend";

let resendClient: Resend | null = null;
let emailFrom: string | null = null;

function getClient(): Resend | null {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  emailFrom = process.env.RESEND_EMAIL_FROM || "AltForge <noreply@altforge.app>";

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured — emails disabled");
    return null;
  }

  resendClient = new Resend(apiKey);
  console.log("[email] Resend client initialized");
  return resendClient;
}

export interface EmailResult {
  id?: string;
  error?: string;
}

/**
 * Send a transactional email via Resend.
 * Fails silently if Resend is not configured — logs warning and returns.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  const client = getClient();
  if (!client) {
    console.warn(`[email] Skipping email (not configured): "${subject}" to ${to}`);
    return { error: "Resend not configured" };
  }

  if (!emailFrom) {
    console.warn("[email] RESEND_EMAIL_FROM not set — skipping");
    return { error: "From address not configured" };
  }

  try {
    const result = await client.emails.send({
      from: emailFrom,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error(`[email] Failed to send "${subject}" to ${to}:`, result.error);
      return { error: result.error.message || "Unknown error" };
    }

    console.log(`[email] Sent "${subject}" to ${to} (id: ${result.data?.id})`);
    return { id: result.data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] Error sending "${subject}" to ${to}:`, message);
    return { error: message };
  }
}
