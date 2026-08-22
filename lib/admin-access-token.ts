import { createHash, timingSafeEqual } from "node:crypto";

export function verifyAdminAccessToken(input: unknown) {
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  if (!expected || typeof input !== "string" || input.length === 0) return false;

  const actualDigest = createHash("sha256").update(input, "utf8").digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
