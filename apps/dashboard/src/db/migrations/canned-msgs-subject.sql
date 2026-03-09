-- Add subject column to canned_msgs for quick message templates
ALTER TABLE canned_msgs ADD COLUMN IF NOT EXISTS subject varchar(255);
