-- Add release_id column to user_messages for tying messages to press releases
ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS release_id INTEGER REFERENCES releases(id);
CREATE INDEX IF NOT EXISTS idx_user_messages_release_id ON user_messages(release_id);
