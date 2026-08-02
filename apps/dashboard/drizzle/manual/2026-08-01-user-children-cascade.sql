-- Make user-owned bookkeeping rows delete with the user. user_profiles,
-- user_subscription, verify, and banners all reference users(id) with the
-- default NO ACTION, which blocks `DELETE FROM users` while any child row
-- exists. Recreate those FKs with ON DELETE CASCADE.
--
-- Note: banners are still referenced by releases.banner_id, so a banner in
-- use by a release will keep blocking its owner's deletion — correct, since
-- that user has a release and shouldn't be casually deleted anyway.
--
-- Deliberately NOT cascaded: company, releases, brand_credits, payments, and
-- other business records that reference users — deleting a user should never
-- silently destroy published releases or financial history. A user who owns
-- those will still be blocked from deletion (by design).
--
-- Run with: psql <fraction connection> -f apps/dashboard/drizzle/manual/2026-08-01-user-children-cascade.sql

DO $$
DECLARE
  t text;
  c text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_profiles', 'user_subscription', 'verify', 'banners'] LOOP
    -- Drop every existing FK from this table to users (name-agnostic: the DB
    -- predates drizzle so constraint names may not follow its convention)
    FOR c IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = t::regclass
        AND contype = 'f'
        AND confrelid = 'users'::regclass
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, c);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %s FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      t, t || '_user_id_users_id_fk'
    );
  END LOOP;
END $$;
