/**
 * Email sending via Resend — SERVER ONLY.
 * https://resend.com/docs
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "TCG Times <noreply@tcgtimes.blog>";

/** Send a 6-digit verification code to a new registrant. */
export async function sendVerificationEmail(opts: {
  to: string;
  firstName: string;
  code: string;
}) {
  const { to, firstName, code } = opts;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your TCG Times account",
    html: verificationTemplate({ firstName, code }),
  });
}

/** Send a password-reset code. */
export async function sendPasswordResetEmail(opts: {
  to: string;
  firstName: string;
  code: string;
}) {
  const { to, firstName, code } = opts;

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your TCG Times password",
    html: resetTemplate({ firstName, code }),
  });
}

// ---------------------------------------------------------------------------
// Email templates (inline HTML — works in all mail clients)
// ---------------------------------------------------------------------------

function base(content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>TCG Times</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5e5;">
      <!-- Header -->
      <tr>
        <td style="padding:32px 40px 24px;border-bottom:1px solid #e5e5e5;">
          <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#111111;">
            TCG Times
          </span>
        </td>
      </tr>
      <!-- Body -->
      <tr><td style="padding:40px 40px 32px;">${content}</td></tr>
      <!-- Footer -->
      <tr>
        <td style="padding:20px 40px;border-top:1px solid #e5e5e5;">
          <p style="margin:0;font-size:12px;color:#888888;">
            You received this email because you created an account at
            <a href="https://tcgtimes.blog" style="color:#111111;">tcgtimes.blog</a>.
            If this wasn't you, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function verificationTemplate({ firstName, code }: { firstName: string; code: string }) {
  return base(`
    <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#111111;">
      Welcome, ${firstName}!
    </h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444444;">
      Thanks for joining TCG Times. Enter the code below to verify your email address
      and activate your account.
    </p>
    <div style="background:#f5f5f5;border:1px solid #e5e5e5;padding:24px;text-align:center;margin-bottom:24px;">
      <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#111111;">
        ${code}
      </span>
    </div>
    <p style="margin:0;font-size:13px;color:#888888;">
      This code expires in <strong>15 minutes</strong>.
    </p>
  `);
}

function resetTemplate({ firstName, code }: { firstName: string; code: string }) {
  return base(`
    <h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#111111;">
      Reset your password
    </h2>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444444;">
      Hi ${firstName}, use the code below to reset your TCG Times password.
    </p>
    <div style="background:#f5f5f5;border:1px solid #e5e5e5;padding:24px;text-align:center;margin-bottom:24px;">
      <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#111111;">
        ${code}
      </span>
    </div>
    <p style="margin:0;font-size:13px;color:#888888;">
      This code expires in <strong>15 minutes</strong>. If you didn't request a reset, ignore this email.
    </p>
  `);
}
