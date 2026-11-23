// GET /api/auth/verify?token=...  -> consumes the link, creates the session cookie.
import { neon } from "@neondatabase/serverless";
import { hashToken, newToken, SESSION_TTL_MS, sessionCookie } from "../../web/server/authCore";

export default async function handler(req: any, res: any) {
  const token = typeof req.query?.token === "string" ? req.query.token : "";
  const { DATABASE_URL, APP_URL } = process.env;
  if (!token || !DATABASE_URL || !APP_URL) return res.redirect(302, `${APP_URL ?? "/"}/?signin=failed`);
  const sql = neon(DATABASE_URL);

  // Single atomic claim: only an unused, unexpired link can be consumed, once.
  const claimed = await sql`UPDATE magic_links SET used_at = now()
    WHERE token_hash = ${hashToken(token)} AND used_at IS NULL AND expires_at > now()
    RETURNING email`;
  if (claimed.length === 0) return res.redirect(302, `${APP_URL}/?signin=failed`);

  const email = claimed[0].email as string;
  const user = await sql`INSERT INTO users (email) VALUES (${email})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`;
  const session = newToken();
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hashToken(session)}, ${user[0].id}, now() + make_interval(secs => ${SESSION_TTL_MS / 1000}))`;
  res.setHeader("Set-Cookie", sessionCookie(session));
  return res.redirect(302, `${APP_URL}/?signin=ok`);
}
