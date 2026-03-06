-- Community Feature Tables Migration
-- Run this SQL manually against the 'fraction' database

-- ─── Community Boards ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_boards (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_class VARCHAR(64),
  color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  rules TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Community Guidelines ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_guidelines (
  id SERIAL PRIMARY KEY,
  body TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert a default empty guidelines row
INSERT INTO community_guidelines (body, updated_at) VALUES ('', NOW());

-- ─── Community Posts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  board_id INTEGER NOT NULL REFERENCES community_boards(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  company_id INTEGER REFERENCES company(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  visibility VARCHAR(16) NOT NULL DEFAULT 'public',
  visibility_company_id INTEGER REFERENCES company(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  comment_count INTEGER NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_posts_board_id ON community_posts(board_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at);

-- ─── Community Post Images ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_post_images (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption VARCHAR(255),
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ─── Community Comments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_comments (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  parent_id INTEGER,
  depth INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent_id ON community_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user_id ON community_comments(user_id);

-- ─── Community Reactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_reactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(10) NOT NULL,
  target_id INTEGER NOT NULL,
  emoji VARCHAR(16) NOT NULL DEFAULT 'like',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_reactions_unique
  ON community_reactions(user_id, target_type, target_id, emoji);

-- ─── User Follows ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_follows_unique
  ON user_follows(follower_id, following_id);

-- ─── Chat Conversations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Chat Participants ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_participants_unique
  ON chat_participants(conversation_id, user_id);

-- ─── Chat Messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(36) NOT NULL UNIQUE,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
