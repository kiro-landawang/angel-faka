import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = new URL("../prisma/schema.prisma", import.meta.url);
const stageUrl = new URL("../prisma/schema.netlify-stage.prisma", import.meta.url);
const schema = await readFile(sourceUrl, "utf8");
const stagedSchema = schema;
await writeFile(stageUrl, stagedSchema, "utf8");

