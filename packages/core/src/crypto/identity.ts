import { sha256 } from "../util/hash.js";
import { getGitEmail } from "../util/git.js";

export function hashEmail(email: string): string {
  return sha256(email.toLowerCase().trim());
}

export async function getIdentityHash(repoRoot: string): Promise<string> {
  const email = await getGitEmail(repoRoot);
  return hashEmail(email);
}
