-- INverge database schema (Cloudflare D1 / SQLite)
-- Timestamps are Unix epoch milliseconds.

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('founder','investor','mentor')),
  name            TEXT NOT NULL,
  country         TEXT,
  city            TEXT,
  avatar_file_id  TEXT,
  headline        TEXT,
  bio             TEXT,
  linkedin_url    TEXT,
  website         TEXT,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  trust_level     INTEGER NOT NULL DEFAULT 0,      -- 0 unverified, 1 basic, 2 gold, 3 elite
  onboarding_step INTEGER NOT NULL DEFAULT 3,      -- 3 verify, 4 prefs, 5 bio, 6 done
  industries      TEXT NOT NULL DEFAULT '',        -- comma separated
  stages          TEXT NOT NULL DEFAULT '',        -- founder: current stage; investor/mentor: stages served
  notif_prefs     TEXT NOT NULL DEFAULT '{}',
  startup_name    TEXT,                            -- founder
  funding_goal    INTEGER,                         -- founder (USD)
  traction        TEXT,                            -- founder
  investor_type   TEXT,                            -- investor
  ticket_min      INTEGER,                         -- investor (USD) - provisional, pending advisor review
  ticket_max      INTEGER,                         -- investor (USD)
  portfolio       TEXT,                            -- investor
  expertise       TEXT NOT NULL DEFAULT '',        -- mentor, comma separated
  years_exp       INTEGER,                         -- mentor
  created_at      INTEGER NOT NULL,
  last_seen       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS otps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL COLLATE NOCASE,
  purpose     TEXT NOT NULL,                       -- signup | reset
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email, purpose);

-- Uploaded binaries live here (base64) because R2 requires a payment method.
-- Max ~1.1MB per file (D1 row limit is 2MB).
CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  owner_id    INTEGER NOT NULL,
  kind        TEXT NOT NULL,                       -- avatar | doc | attachment
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);

CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  kind        TEXT NOT NULL,                       -- gov_id | registration | pitch_deck | investment_proof | portfolio | resume | certification
  file_id     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
  note        TEXT,
  is_public   INTEGER NOT NULL DEFAULT 0,          -- pitch decks only: visible to verified users
  created_at  INTEGER NOT NULL,
  reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,                       -- update | funding | call | insight | learning
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);

CREATE TABLE IF NOT EXISTS post_reactions (post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));
CREATE TABLE IF NOT EXISTS post_saves     (post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));
CREATE TABLE IF NOT EXISTS post_shares    (post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (post_id, user_id));

CREATE TABLE IF NOT EXISTS comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id     INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

CREATE TABLE IF NOT EXISTS connections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id  INTEGER NOT NULL,
  addressee_id  INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | declined
  created_at    INTEGER NOT NULL,
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_conn_addr ON connections(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_conn_req ON connections(requester_id, status);

CREATE TABLE IF NOT EXISTS saved_profiles (user_id INTEGER NOT NULL, saved_id INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, saved_id));
CREATE TABLE IF NOT EXISTS skips          (user_id INTEGER NOT NULL, skipped_id INTEGER NOT NULL, PRIMARY KEY (user_id, skipped_id));

CREATE TABLE IF NOT EXISTS profile_views (
  viewer_id   INTEGER NOT NULL,
  profile_id  INTEGER NOT NULL,
  day         TEXT NOT NULL,                       -- YYYY-MM-DD (UTC)
  PRIMARY KEY (viewer_id, profile_id, day)
);
CREATE INDEX IF NOT EXISTS idx_views_profile ON profile_views(profile_id, day);

CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id     INTEGER NOT NULL,
  recipient_id  INTEGER NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'text',      -- text | pitch | meeting
  body          TEXT NOT NULL,
  file_id       TEXT,
  file_name     TEXT,
  meta          TEXT,                              -- json (meeting time etc.)
  created_at    INTEGER NOT NULL,
  read_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_msg_pair ON messages(sender_id, recipient_id, id);
CREATE INDEX IF NOT EXISTS idx_msg_recipient ON messages(recipient_id, read_at);

CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,       -- connection_request | connection_accepted | message | booking | verification | comment
  actor_id    INTEGER,
  text        TEXT NOT NULL,
  link        TEXT,
  read        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, id DESC);

CREATE TABLE IF NOT EXISTS mentor_slots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id     INTEGER NOT NULL,
  starts_at     INTEGER NOT NULL,
  duration_min  INTEGER NOT NULL DEFAULT 30,
  status        TEXT NOT NULL DEFAULT 'open'       -- open | booked
);
CREATE INDEX IF NOT EXISTS idx_slots_mentor ON mentor_slots(mentor_id, starts_at);

CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id     INTEGER NOT NULL UNIQUE,
  mentor_id   INTEGER NOT NULL,
  mentee_id   INTEGER NOT NULL,
  topic       TEXT,
  status      TEXT NOT NULL DEFAULT 'confirmed',   -- confirmed | completed | cancelled
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_book_mentor ON bookings(mentor_id);
CREATE INDEX IF NOT EXISTS idx_book_mentee ON bookings(mentee_id);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id  INTEGER NOT NULL UNIQUE,
  mentor_id   INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_mentor ON reviews(mentor_id);

CREATE TABLE IF NOT EXISTS questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  tag         TEXT,
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS answers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_answers_q ON answers(question_id);

CREATE TABLE IF NOT EXISTS resources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,                       -- guide | template | video | community
  title       TEXT NOT NULL,
  summary     TEXT,
  body        TEXT,
  url         TEXT,
  author_id   INTEGER,
  author_name TEXT,
  tags        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
