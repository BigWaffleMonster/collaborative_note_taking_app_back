import { sql } from "./index";

const migrationPath = new URL("./migrations/001_auth.sql", import.meta.url);

try {
  const migration = await Bun.file(migrationPath).text();

  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
  });

  console.log("Authentication migration applied successfully.");
} finally {
  await sql.end();
}
