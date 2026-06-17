import { Resend } from "resend";

/**
 * Transactional email — calm, on-brand templates sent through Resend.
 *
 * Better Auth's email callbacks (verification + magic link) delegate here. If
 * RESEND_API_KEY is unset (e.g. a preview deploy with no secret), we log the
 * link to the server console instead of throwing, so local/dev flows still work
 * without a live email provider.
 */

const FROM = "UniKart <no-reply@uni-kart.com>";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendArgs): Promise<void> {
  const resend = client();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send to ${to}. Subject: "${subject}".`,
    );
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error("[email] Resend send failed:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

/**
 * A single calm, inline-styled email shell — quiet porcelain background, soft
 * card, one clear action. Inline styles only (email clients ignore <style>).
 */
function shell(opts: {
  preheader: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footnote: string;
}): string {
  const { preheader, heading, body, ctaLabel, ctaUrl, footnote } = opts;
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f7f7f5;">
    <span style="display:none;font-size:1px;color:#f7f7f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#ffffff;border:1px solid #ececec;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:36px 36px 8px 36px;">
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#1a1a1a;">
                  UniKart
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px 0 36px;">
                <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.02em;line-height:1.3;color:#1a1a1a;">
                  ${heading}
                </h1>
                <p style="margin:12px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#62656b;">
                  ${body}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 36px 8px 36px;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;background-color:#1a1a1a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;text-decoration:none;padding:13px 28px;border-radius:14px;">
                  ${ctaLabel}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 36px 36px;">
                <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#9a9da3;">
                  ${footnote}
                </p>
                <p style="margin:16px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#bfc1c6;word-break:break-all;">
                  Or paste this link into your browser:<br />${ctaUrl}
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#bfc1c6;">
            UniKart · one calm cart for everything you want
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Public senders (wired into Better Auth)                             */
/* ------------------------------------------------------------------ */

/** "Confirm your email" — sent on sign-up to verify ownership. */
export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: "Confirm your email",
    html: shell({
      preheader: "Confirm your email to finish setting up UniKart.",
      heading: "Confirm your email",
      body: "Welcome to UniKart. Confirm this address to finish setting up your account and start saving the things you want.",
      ctaLabel: "Confirm email",
      ctaUrl: url,
      footnote:
        "If you didn’t create a UniKart account, you can safely ignore this email.",
    }),
  });
}

/** "Your sign-in link" — passwordless magic-link sign-in. */
export async function sendMagicLinkEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: "Your sign-in link",
    html: shell({
      preheader: "Your sign-in link for UniKart.",
      heading: "Your sign-in link",
      body: "Tap the button below to sign in to UniKart. This link works once and expires shortly, so it stays just for you.",
      ctaLabel: "Sign in",
      ctaUrl: url,
      footnote:
        "If you didn’t request this link, you can safely ignore this email — no one can sign in without it.",
    }),
  });
}

/** "Reset your password" — sent when a signed-out user forgets their password. */
export async function sendResetPasswordEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: "Reset your password",
    html: shell({
      preheader: "Reset your UniKart password.",
      heading: "Reset your password",
      body: "We received a request to reset the password for your UniKart account. Tap below to choose a new one. This link expires shortly.",
      ctaLabel: "Choose a new password",
      ctaUrl: url,
      footnote:
        "If you didn’t request this, you can safely ignore this email — your password won’t change.",
    }),
  });
}

/** "Confirm you want to delete your account" — guards account deletion. */
export async function sendDeleteAccountEmail(to: string, url: string): Promise<void> {
  await send({
    to,
    subject: "Confirm account deletion",
    html: shell({
      preheader: "Confirm you want to delete your UniKart account.",
      heading: "Delete your account",
      body: "You asked to permanently delete your UniKart account and all of its data. This can’t be undone. If that’s what you want, confirm below.",
      ctaLabel: "Delete my account",
      ctaUrl: url,
      footnote:
        "If you didn’t request this, ignore this email and your account stays exactly as it is.",
    }),
  });
}
