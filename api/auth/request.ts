// POST /api/auth/request  { email }  -> emails a 15-minute single-use sign-in link.
// Always answers the same way so it never reveals whether an email has an account.
import { neon } from "@neondatabase/serverless";
import { Resend } from "resend";
import { hashToken, MAGIC_LINK_TTL_MS, newToken, normalizeEmail } from "../../web/server/authCore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email address." });

  const { DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, APP_URL } = process.env;
  if (!DATABASE_URL || !RESEND_API_KEY || !EMAIL_FROM || !APP_URL) {
    return res.status(503).json({ error: "Sign-in is not configured yet." });
  }
  const sql = neon(DATABASE_URL);
  // Throttle: at most 3 links per email per 15 minutes.
  const recent = await sql`SELECT count(*)::int AS n FROM magic_links
    WHERE email = ${email} AND expires_at > now()`;
  if (recent[0].n < 3) {
    const token = newToken();
    await sql`INSERT INTO magic_links (token_hash, email, expires_at)
      VALUES (${hashToken(token)}, ${email}, now() + make_interval(secs => ${MAGIC_LINK_TTL_MS / 1000}))`;
    const link = `${APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
    await new Resend(RESEND_API_KEY).emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "Your Chegga sign-in link",
      text: `Open this link to sign in to Chegga (valid 15 minutes, one use):\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });
  }
  return res.status(200).json({ ok: true });
}
