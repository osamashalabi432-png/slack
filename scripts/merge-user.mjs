#!/usr/bin/env node
/**
 * Move everything one user owns onto another user's id.
 *
 *   node scripts/merge-user.mjs <old-id> <new-id>
 *   node scripts/merge-user.mjs <old-id> <new-id> --apply
 *
 * Written for a change of auth provider: signing in against a different Stack
 * Auth project hands the same person a brand new id, so their workspaces,
 * messages and pages are left behind on the old row. This repoints every
 * foreign key at the new id and removes the old row.
 *
 * Nothing is written without --apply. The columns are read from the catalogue
 * rather than listed here, so a new table referencing users is picked up
 * automatically.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(join(root, ".env"), "utf8");
const url = /^DATABASE_URL=(.*)$/m.exec(envText)?.[1]?.trim();
if (!url) {
  console.error("No DATABASE_URL in .env");
  process.exit(1);
}

const [oldId, newId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");
if (!oldId || !newId) {
  console.error("Usage: node scripts/merge-user.mjs <old-id> <new-id> [--apply]");
  process.exit(1);
}

const sql = postgres(url, { onnotice: () => {} });

const [oldUser] = await sql`select id, email, display_name from users where id = ${oldId}`;
const [newUser] = await sql`select id, email, display_name from users where id = ${newId}`;
if (!oldUser) throw new Error(`No user ${oldId}`);
if (!newUser) throw new Error(`No user ${newId} — sign in as them first so the row exists`);

console.log(`from  ${oldUser.id}  ${oldUser.email}  (${oldUser.display_name})`);
console.log(`to    ${newUser.id}  ${newUser.email}  (${newUser.display_name})`);
console.log("");

const columns = await sql`
  select c.conrelid::regclass::text as table_name, a.attname as column_name
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.contype = 'f' and c.confrelid = 'users'::regclass
  order by 1, 2
`;

let total = 0;
const moved = [];
for (const { table_name, column_name } of columns) {
  const [{ count }] = await sql`
    select count(*)::int as count from ${sql(table_name)} where ${sql(column_name)} = ${oldId}
  `;
  if (count > 0) {
    moved.push({ table_name, column_name, count });
    total += count;
  }
}

for (const m of moved) console.log(`  ${m.count.toString().padStart(5)}  ${m.table_name}.${m.column_name}`);
console.log(`\n  ${total} rows across ${moved.length} columns`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to move them.");
  await sql.end();
  process.exit(0);
}

// One transaction: either the whole identity moves or none of it does. A
// unique violation here means the new user already holds the same thing (the
// same channel membership, say) and needs looking at by hand.
await sql.begin(async (tx) => {
  for (const { table_name, column_name } of moved) {
    await tx`update ${tx(table_name)} set ${tx(column_name)} = ${newId} where ${tx(column_name)} = ${oldId}`;
  }
  await tx`delete from users where id = ${oldId}`;
});

console.log("\nMoved. The old row is gone.");
await sql.end();
