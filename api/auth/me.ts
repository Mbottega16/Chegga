// GET /api/auth/me -> { email } for the signed-in user, 401 otherwise.
import { neon } from "@neondatabase/serverless";
import { hashToken, readSessionToken } from "../../web/server/authCore";

export default async function handler(req: any, res: any) {
  const token = readSessionToken(req.headers?.cookie);
  const { DATABASE_URL } = process.env;
  if (!token || !DATABASE_URL) return res.status(401).json({ error: "Not signed in." });
  const sql = neon(DATABASE_URL);
  const rows = await sql`SELECT u.email FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > now()`;
  if (rows.length === 0) return res.status(401).json({ error: "Not signed in." });
  return res.status(200).json({ email: rows[0].email });
}
