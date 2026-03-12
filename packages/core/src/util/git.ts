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
