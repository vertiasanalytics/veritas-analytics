import app from "./app";
import { runMigrations } from "./lib/migrate.js";
import { seedDatabase } from "./lib/seed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await runMigrations();
  } catch (err) {
    console.error("[migrate] Erro ao executar migrações:", err);
  }
  try {
    await seedDatabase();
  } catch (err) {
    console.error("[seed] Erro ao executar seed:", err);
  }
});
