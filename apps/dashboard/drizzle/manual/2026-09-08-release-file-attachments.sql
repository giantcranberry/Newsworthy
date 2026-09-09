-- Press release file attachments
-- Run on fraction DB

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS filename varchar(255),
  ADD COLUMN IF NOT EXISTS mime_type varchar(100),
  ADD COLUMN IF NOT EXISTS filesize integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source varchar(32) DEFAULT 'linode',
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

ALTER TABLE release_files
  ADD COLUMN IF NOT EXISTS id serial,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

DO $$
BEGIN
  -- Skip unique if a primary key already enforces uniqueness (legacy composite PK)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'release_files_release_file_unique'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'release_files'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE release_files
      ADD CONSTRAINT release_files_release_file_unique UNIQUE (release_id, file_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'release_files_file_id_files_id_fk'
  ) THEN
    ALTER TABLE release_files
      ADD CONSTRAINT release_files_file_id_files_id_fk
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
  END IF;
END $$;
