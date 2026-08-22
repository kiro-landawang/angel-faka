import { readFile, writeFile } from "node:fs/promises";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const schema = await readFile(schemaPath, "utf8");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Netlify PostgreSQL deployment");
}

if (!/^\s*provider\s*=\s*"postgresql"/m.test(schema)) {
  const updated = schema.replace(
    /(^\s*provider\s*=\s*)"sqlite"/m,
    '$1"postgresql"',
  );

  if (updated === schema) {
    throw new Error("Could not find the Prisma datasource provider in prisma/schema.prisma");
  }

  await writeFile(schemaPath, updated, "utf8");
}
