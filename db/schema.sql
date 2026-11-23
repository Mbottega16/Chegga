-- Chegga accounts + sync schema (Postgres / Neon). Run once; idempotent.
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS magic_links (
  token_hash  text PRIMARY KEY,
  email       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS linked_accounts (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site       text NOT NULL CHECK (site IN ('chesscom','lichess')),
  username   text NOT NULL,
  linked_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, site, username)
);
CREATE TABLE IF NOT EXISTS games (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id  text NOT NULL,
  site       text NOT NULL,
  pgn        text NOT NULL,
  end_time   bigint NOT NULL,
  meta       jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, source_id)
);
CREATE TABLE IF NOT EXISTS move_analysis (
  user_id        uuid NOT NULL,
  source_id      text NOT NULL,
  ply            int  NOT NULL,
  engine_version text NOT NULL,
  data           jsonb NOT NULL,
  PRIMARY KEY (user_id, source_id, ply, engine_version),
  FOREIGN KEY (user_id, source_id) REFERENCES games(user_id, source_id) ON DELETE CASCADE
);
