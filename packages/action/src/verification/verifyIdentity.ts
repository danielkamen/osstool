import { hashEmail } from "@contrib-provenance/core";

interface CommitData {
  sha: string;
  commit: {
    author: {
      email: string | null;
    } | null;
    committer: {
      date: string;
    } | null;
  };
}

export function verifyIdentity(
  attestationIdentity: string,
  commits: CommitData[],
): boolean {
  return commits.some((c) => {
    const email = c.commit.author?.email;
    if (!email) return false;
    return hashEmail(email) === attestationIdentity;
  });
}

export function verifyCommitBinding(
  attestationCommit: string,
  commits: CommitData[],
): boolean {
  return commits.some((c) => c.sha === attestationCommit);
}

export function checkFreshness(
  attestationTimestamp: string,
  attestationCommit: string,
  commits: CommitData[],
): boolean {
  const commit = commits.find((c) => c.sha === attestationCommit);
  if (!commit?.commit.committer?.date) return false;

  const commitTime = new Date(commit.commit.committer.date).getTime();
  const attestTime = new Date(attestationTimestamp).getTime();
  const hoursDiff = Math.abs(attestTime - commitTime) / 3_600_000;
  return hoursDiff < 24;
}
