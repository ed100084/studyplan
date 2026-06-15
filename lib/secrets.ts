import { createHash, timingSafeEqual } from "node:crypto";

export function secretsEqual(candidate: string, expected: string | undefined) {
  if (!candidate || !expected) return false;

  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}
