/**
 * Email Service (Resend)
 *
 * Transactional email capability for notifications.
 * Optional in development - skips when RESEND_API_KEY is not set.
 */

let resendClient: { emails: { send: (params: EmailParams) => Promise<{ id: string }> } } | null =
  null;

interface EmailParams {
  from: string;
  to: string;
  subject: string;
  html: string;
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Get or create Resend client (lazy initialization)
 */
async function getResendClient() {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!resendClient) {
    // Dynamic import to avoid loading resend in dev when not needed
    try {
      const { Resend } = await import("resend");
      resendClient = new Resend(process.env.RESEND_API_KEY) as unknown as typeof resendClient;
    } catch {
      console.warn(
        "[Email] Failed to initialize Resend client. Install 'resend' package to enable email.",
      );
      return null;
    }
  }

  return resendClient;
}

/**
 * Get the sender address
 */
function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "Morph <notifications@morph.app>";
}

/**
 * Send an email
 * Returns true if sent successfully, false if skipped or failed
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  const client = await getResendClient();

  if (!client) {
    console.log(`[Email] Skipped (not configured): "${subject}" -> ${to}`);
    return { success: false, error: "Email service not configured" };
  }

  try {
    await client.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Email] Failed to send "${subject}" -> ${to}:`, message);
    return { success: false, error: message };
  }
}

/**
 * Send a welcome email to new users
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Welcome to Morph, ${escapeHtml(name)}!</h1>
      <p>Your account has been created successfully. You're ready to start building.</p>
      <p>You've received <strong>50 daily credits</strong> to get started. These reset every day!</p>
      <p>Happy building!</p>
    </div>
  `;

  return sendEmail(to, "Welcome to Morph!", html);
}

/**
 * Escape HTML entities for safe email rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
