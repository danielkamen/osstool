import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";

const execFile = promisify(execFileCb);

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFile("git", args, { cwd, timeout: 10_000 });
  return stdout.trim();
}

export function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

export async function getHeadSha(repoRoot: string): Promise<string> {
  return git(["rev-parse", "HEAD"], repoRoot);
}

export async function getRemoteUrl(repoRoot: string): Promise<string> {
  return git(["remote", "get-url", "origin"], repoRoot);
}

export async function getGitEmail(repoRoot: string): Promise<string> {
  return git(["config", "user.email"], repoRoot);
}

export async function getGitConfig(key: string, repoRoot: string): Promise<string | null> {
  try {
    return await git(["config", key], repoRoot);
  } catch {
    return null;
  }
}

export interface CommitLogEntry {
  sha: string;
  timestamp: string;
  email: string;
}

export interface DiffNumstatEntry {
  file: string;
  added: number;
  deleted: number;
}

export async function getMergeBase(repoRoot: string, baseBranch: string): Promise<string> {
  try {
    return await git(["merge-base", "HEAD", baseBranch], repoRoot);
  } catch {
    // If merge-base fails (e.g., unrelated histories), fall back to first commit
    return git(["rev-list", "--max-parents=0", "HEAD"], repoRoot);
  }
}

export async function getCommitLog(repoRoot: string, sinceRef: string): Promise<CommitLogEntry[]> {
  const raw = await git(
    ["log", `${sinceRef}..HEAD`, "--format=%H %aI %aE"],
    repoRoot,
  );
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const [sha, timestamp, ...emailParts] = line.split(" ");
    return { sha, timestamp, email: emailParts.join(" ") };
  });
}

export async function getDiffNumstat(repoRoot: string, sinceRef: string): Promise<DiffNumstatEntry[]> {
  const raw = await git(["diff", "--numstat", `${sinceRef}..HEAD`], repoRoot);
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((line) => {
    const [addedStr, deletedStr, ...fileParts] = line.split("\t");
    return {
      file: fileParts.join("\t"),
      added: addedStr === "-" ? 0 : parseInt(addedStr, 10),
      deleted: deletedStr === "-" ? 0 : parseInt(deletedStr, 10),
    };
  });
}

export async function getCurrentBranch(repoRoot: string): Promise<string> {
  return git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
}

export async function getDefaultBranch(repoRoot: string): Promise<string> {
  try {
    const ref = await git(["symbolic-ref", "refs/remotes/origin/HEAD"], repoRoot);
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    for (const branch of ["main", "master"]) {
      try {
        await git(["rev-parse", "--verify", `refs/heads/${branch}`], repoRoot);
        return branch;
      } catch {
        continue;
      }
    }
    return "main";
  }
}

export function parseRemoteToSlug(remoteUrl: string): string {
  // Handle SSH: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;

  // Handle HTTPS: https://github.com/owner/repo.git
  try {
    const url = new URL(remoteUrl);
    const path = url.pathname.replace(/^\//, "").replace(/\.git$/, "");
    return `${url.hostname}/${path}`;
  } catch {
    return remoteUrl;
  }
}
