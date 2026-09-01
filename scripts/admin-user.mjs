#!/usr/bin/env node
/**
 * Create, re-password, disable and list back-office accounts.
 *
 * **The only way an account comes into existence.** There is no sign-up route
 * and there will not be one: this is a back-office for three people at one
 * agency, and a public registration form on it would be a door with a hinge and
 * no lock. ADR-0011 records the decision; this file is what it costs — an SSH
 * call to the owner, the same posture as `migrate.mjs`.
 *
 * Connects as the **owner**, not as `belso_editor`. The editor role has no
 * `insert` on `admin_users` precisely so that a defect in the back-office
 * cannot mint an account for whoever found it (`0006_editor_role.sql`), which
 * means account creation has to come from somewhere else. This is somewhere
 * else.
 *
 * Run:
 *
 *   node --import ./scripts/lib/ts-alias-hook.mjs scripts/admin-user.mjs create sofia@belso.ma "Sofia"
 *   node --import ./scripts/lib/ts-alias-hook.mjs scripts/admin-user.mjs password sofia@belso.ma
 *   node --import ./scripts/lib/ts-alias-hook.mjs scripts/admin-user.mjs disable sofia@belso.ma
 *   node --import ./scripts/lib/ts-alias-hook.mjs scripts/admin-user.mjs list
 *
 * or `pnpm admin:user <command> …`, which supplies the hook.
 */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { loadEnvLocal } from "./lib/env-local.mjs";
import { hashPassword } from "../src/features/admin/password.ts";

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url?.trim()) {
  console.error("admin-user: DATABASE_URL is not set — see `pnpm db:tunnel`.");
  process.exit(1);
}

const [command, ...argv] = process.argv.slice(2);

/*
 * Flags separated from positional arguments before either is read.
 *
 * `create` half-supported `--stdin`: it checked for the flag when choosing the
 * password, and then folded it into the display name, which is "everything
 * after the email". `create sofia@belso.ma "Sofia Belso" --stdin` made an
 * account called `Sofia Belso --stdin` with the piped password — wrong in the
 * direction that hides itself, because the password works and the name is only
 * seen later, in the back-office header.
 */
const useStdin = argv.includes("--stdin");
const args = argv.filter((argument) => argument !== "--stdin");

function usage(message) {
  if (message) console.error(`admin-user: ${message}\n`);
  console.error("Usage:");
  console.error("  admin-user create <email> <display name>  [--stdin]");
  console.error("  admin-user password <email>          [--stdin]");
  console.error("  admin-user disable <email>");
  console.error("  admin-user enable <email>");
  console.error("  admin-user list");
  process.exit(1);
}

/**
 * A generated password rather than one typed at a prompt.
 *
 * Hiding terminal echo portably is more code than the rest of this file, and a
 * password typed over SSH is a password chosen by a person under mild time
 * pressure — which is how a back-office ends up protected by the agency's
 * postcode. Twenty-four random characters go straight into a password manager
 * and are never thought about again.
 *
 * `--stdin` exists for the person who genuinely wants to choose, and reads the
 * value from a pipe rather than an argument: an argument is visible in `ps` to
 * every other process on the box, which on this one includes the client's n8n.
 */
function generate() {
  return randomBytes(18).toString("base64url");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const value = Buffer.concat(chunks).toString("utf8").trim();
  if (!value) usage("--stdin was given but nothing arrived on stdin");
  return value;
}

/**
 * Destroy every live session for one account. Returns how many there were.
 *
 * **Changing a password has to do this, and for a while it did not.** Only
 * `disable` swept sessions; `password` wrote a new hash and left the old
 * cookies working for the rest of their seven days. That is precisely backwards
 * for the case the command exists to serve — you re-password an account because
 * you think somebody else has it, and the whole point is that they stop being
 * signed in. The reasoning had been done once, for `disable`, and never carried
 * across to its neighbour; a security review found it. One function now, so
 * there is one place to reason about rather than two to keep in step.
 *
 * `select id` rather than a join, so a typo'd address deletes nothing instead of
 * everything.
 */
async function revokeSessions(email) {
  const { rowCount } = await client.query(
    `delete from admin_sessions
      where user_id in (select id from admin_users where lower(email) = lower($1))`,
    [email],
  );
  return rowCount;
}

/** Say what was revoked, if anything. Silence when there was nothing to revoke. */
function reportRevoked(count) {
  if (count > 0) {
    console.log(`  ${count} existing session(s) signed out.`);
  }
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  switch (command) {
    case "create": {
      const [email, ...rest] = args;
      const displayName = rest.join(" ").trim();
      if (!email || !displayName) usage("create needs an email and a display name");

      const password = useStdin ? await readStdin() : generate();
      const hash = await hashPassword(password);

      /*
       * `on conflict` on the case-insensitive index, so re-running this against
       * an existing address updates rather than failing — the difference
       * between "run it again" and "work out what state the database is in".
       */
      const { rows } = await client.query(
        `insert into admin_users (email, password_hash, display_name)
         values ($1, $2, $3)
         on conflict (lower(email)) do update
           set password_hash = excluded.password_hash,
               display_name  = excluded.display_name,
               disabled_at   = null,
               updated_at    = now()
         returning id, (xmax = 0) as created`,
        [email, hash, displayName],
      );

      const { created } = rows[0];

      /*
       * Revoked unconditionally, not only on the update branch.
       *
       * This read `created ? 0 : await revokeSessions(email)`, which made
       * revocation depend on `(xmax = 0)` — a Postgres heap internal, and one
       * whose two failure directions are not equal. A fresh insert misreported
       * as an update costs a `delete` that matches nothing. An update
       * misreported as an insert leaves a changed password with live sessions,
       * which is the one thing this function exists to prevent. Nothing is
       * bought by the conditional: a genuinely new account has no session rows.
       */
      const revoked = await revokeSessions(email);

      console.log(`\nadmin-user: ${created ? "created" : "updated"} ${email} (${displayName})`);
      console.log(`  password: ${password}`);
      reportRevoked(revoked);
      console.log("\nCopy it now — it is hashed, not stored, and cannot be shown again.");
      break;
    }

    case "password": {
      const [email] = args;
      if (!email) usage("password needs an email");

      const password = useStdin ? await readStdin() : generate();

      /*
       * One transaction, because the two halves are one act.
       *
       * The new hash is not the whole job — the cookies issued under the old one
       * stay valid for seven days unless they are destroyed. Run as two
       * autocommitted statements, a failure between them (these run over an SSH
       * tunnel, so a dropped connection is the ordinary case) leaves the account
       * with a password nobody knows *and* the old sessions still live: worse
       * than either outcome alone, and the password is not printed until after.
       */
      await client.query("begin");
      let rowCount;
      let revoked;
      try {
        ({ rowCount } = await client.query(
          "update admin_users set password_hash = $2, updated_at = now() where lower(email) = lower($1)",
          [email, await hashPassword(password)],
        ));

        if (rowCount === 0) {
          await client.query("rollback");
          usage(`no account for ${email}`);
        }

        revoked = await revokeSessions(email);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }

      console.log(`\nadmin-user: new password for ${email}`);
      console.log(`  password: ${password}`);
      reportRevoked(revoked);
      console.log("\nCopy it now — it is hashed, not stored, and cannot be shown again.");
      break;
    }

    case "disable":
    case "enable": {
      const [email] = args;
      if (!email) usage(`${command} needs an email`);

      const { rowCount } = await client.query(
        `update admin_users
            set disabled_at = ${command === "disable" ? "now()" : "null"}, updated_at = now()
          where lower(email) = lower($1)`,
        [email],
      );

      if (rowCount === 0) usage(`no account for ${email}`);

      /*
       * Disabling has to take effect now, not at the end of a seven-day
       * session. `currentSession` checks `disabled_at is null` on every
       * request, so this is already true — but destroying the rows means the
       * cookie in her browser stops working rather than merely stops being
       * honoured, which is what somebody asking for an account to be closed
       * actually means.
       */
      if (command === "disable") await revokeSessions(email);

      console.log(`admin-user: ${command}d ${email}`);
      break;
    }

    case "list": {
      const { rows } = await client.query(
        `select email, display_name, disabled_at,
                (select count(*) from admin_sessions s
                  where s.user_id = u.id and s.expires_at > now()) as sessions
           from admin_users u order by email`,
      );

      if (rows.length === 0) {
        console.log("admin-user: no accounts. Create one with `admin-user create`.");
        break;
      }

      for (const row of rows) {
        const state = row.disabled_at ? "disabled" : `${row.sessions} session(s)`;
        console.log(`  ${row.email.padEnd(28)} ${row.display_name.padEnd(20)} ${state}`);
      }
      break;
    }

    default:
      usage(command ? `unknown command "${command}"` : undefined);
  }
} finally {
  await client.end();
}
