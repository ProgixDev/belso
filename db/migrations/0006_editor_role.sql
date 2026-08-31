-- 0006 — `belso_editor`, the role the back-office writes as.
--
-- ADR-0010. `belso_app` (0004) reads published listings and inserts enquiries,
-- and that is all it can do — deliberately, because the storefront is the one
-- part of this system a stranger can reach. The back-office needs to write, and
-- the tempting move is to widen `belso_app`.
--
-- Widening it would undo the exact property 0004 exists to hold. `loadBySlug`
-- is the one place an anonymous visitor's string reaches SQL; a defect there
-- today yields listings that are already published on the website. With write
-- grants attached to the same role, the same defect yields the catalogue and
-- every enquiry — names, emails, phone numbers.
--
-- So: a second role, a second connection string, and `src/core/db.ts` keeps the
-- two on separate pools. The audit is one command — if `editorQuery` and
-- `editorTransaction` do not appear in the public read path, that path
-- provably cannot write.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'belso_editor') then
    -- No password here, for the reason 0004 gives: a secret does not belong in
    -- a committed file. `scripts/vps/belso-roles.sh` generates one and sets it.
    -- Until it does, the role exists and cannot authenticate.
    create role belso_editor with login;
  end if;
end
$$;

revoke all on schema public from belso_editor;
grant usage on schema public to belso_editor;

-- ---------------------------------------------------------------------------
-- The catalogue
-- ---------------------------------------------------------------------------
grant select, insert, update on
  properties,
  property_translations,
  property_media,
  property_media_alt
to belso_editor;

-- Removing a photograph, or an English translation added by mistake, is a real
-- editorial action with nothing to preserve.
grant delete on property_media, property_media_alt, property_translations to belso_editor;

-- **No `delete` on `properties`, on purpose.** AC-4 is that archiving retains
-- the listing: its enquiries still name it, its old addresses still redirect to
-- it, and a client who meant "take it off the site" must not be able to destroy
-- that by clicking the wrong control. Removing a listing for real is a decision
-- someone makes over SSH, having thought about it.

-- Districts are read to place a listing, and are not editable from the
-- back-office: the ten neighbourhoods are the product, not content.
grant select on districts, district_translations to belso_editor;

-- Renaming a listing writes slug history — and it writes it from inside the
-- trigger added in 0002, which is plain `plpgsql` with **no `security
-- definer`**, so it runs as whoever ran the UPDATE. Miss this grant and the
-- rename fails with a permission error raised from inside a trigger, which
-- reads like a broken migration and is in fact a missing line here. `update`
-- as well as `insert` because the trigger's `on conflict … do update` re-dates
-- a slug that is being retired for the second time.
grant select, insert, update on property_slug_history to belso_editor;

-- ---------------------------------------------------------------------------
-- Signing in
-- ---------------------------------------------------------------------------
-- Reading `admin_users` means reading password hashes, which is why this is the
-- editor's grant and not the app's: `belso_app` has no business seeing them,
-- and after this migration it still cannot.
--
-- No `insert` and no `delete`. Accounts are made by `scripts/admin-user.mjs`
-- running as the owner, so a defect in the back-office cannot mint an account
-- for its author. `update` is granted because a person changing their own
-- password is an ordinary thing that should not need SSH.
grant select, update on admin_users to belso_editor;

-- Sessions are created, touched and destroyed by the app itself; there is no
-- other actor. `delete` is sign-out, and the sweep of expired rows.
grant select, insert, update, delete on admin_sessions to belso_editor;

-- The login throttle counts, so it reads its own row back and increments it.
-- Granted to the editor and to nobody else — `belso_app` in particular, whose
-- code runs on every public page.
--
-- **No `delete`, and it is worth being honest about how little that buys.**
-- Counting requires `update`, and an `update` can set a count to zero as
-- surely as a `delete` can remove the row, so withholding one and granting the
-- other is not a barrier. It is withheld because nothing needs it — least
-- privilege as a habit rather than as a defence — and the integrity of this
-- table genuinely rests on the sign-in code path, which resets a counter only
-- after a password has already been verified. A comment claiming otherwise
-- would be the kind of reassurance that stops somebody looking.
grant select, insert, update on admin_login_throttle to belso_editor;

-- ---------------------------------------------------------------------------
-- Not granted, and worth saying so
-- ---------------------------------------------------------------------------
-- `enquiries` is untouched here. The inbox is spec 012, and until the code that
-- reads leads exists, the role that would read them should not be able to.
-- Granting ahead of the feature is how a privilege ends up with no reader and
-- no reviewer.
--
-- `enquiry_throttle` likewise: it belongs to the public contact form, which the
-- back-office has no part in.
--
-- And as 0004 already records, a table added by a later migration is invisible
-- to both roles until someone grants it. That is the safe direction — a new
-- table is unreadable until it is decided that it should be, rather than
-- readable because nobody thought about it.
