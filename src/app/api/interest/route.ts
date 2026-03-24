import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";

// ---------------------------------------------------------------------------
// POST /api/interest
// Body: { email: string }
//
// Saves the email to the `interest` table (upsert — safe to call twice) and
// sends a one-time confirmation email to the visitor.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: "" }));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const normalised = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // ── Persist to Neon (or silently skip if DATABASE_URL isn't set yet) ──────
  const dbUrl = process.env.DATABASE_URL;
  let alreadyRegistered = false;

  if (dbUrl) {
    const db = neon(dbUrl);
    const existing = await db`
      SELECT email FROM interest WHERE email = ${normalised} LIMIT 1
    `;
    alreadyRegistered = existing.length > 0;

    if (!alreadyRegistered) {
      await db`
        INSERT INTO interest (email) VALUES (${normalised})
        ON CONFLICT (email) DO NOTHING
      `;
    }
  }

  // ── Send confirmation email (only on first sign-up) ───────────────────────
  if (!alreadyRegistered && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "TCG Times <noreply@tcgtimes.blog>",
      to: normalised,
      subject: "You're on the list — TCG Times",
      html: confirmationTemplate(normalised),
    }).catch(() => {
      // Non-fatal — email failure shouldn't block the response
    });
  }

  return NextResponse.json({ ok: true, alreadyRegistered });
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

function confirmationTemplate(email: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:48px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border:1px solid #ddd;max-width:520px;width:100%;">

        <!-- Header bar -->
        <tr>
          <td style="background:#111;padding:28px 40px;">
            <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;
                       color:#888;font-family:Arial,sans-serif;">tcgtimes.blog</p>
            <h1 style="margin:8px 0 0;font-size:28px;color:#ffffff;font-weight:900;
                       letter-spacing:-0.5px;">TCG Times</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 16px;font-size:22px;color:#111;font-weight:700;">
              You&rsquo;re on the list.
            </h2>
            <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
              Thanks for your interest in <strong>TCG Times</strong> — theory, strategy
              &amp; stories from the card table.
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
              We&rsquo;ll drop you a note at
              <strong>${email}</strong> the moment we launch.
              No spam, no filler — just the launch announcement.
            </p>
            <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
              — The TCG Times team
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #eee;padding:20px 40px;">
            <p style="margin:0;font-size:11px;color:#aaa;font-family:Arial,sans-serif;">
              You received this because you signed up at tcgtimes.blog.<br />
              If this was a mistake, you can safely ignore this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
