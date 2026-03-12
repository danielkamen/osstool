import * as core from "@actions/core";

interface ReplayResult {
  isReplay: boolean;
  detail?: string;
}

export async function checkReplay(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  sessionId: string,
): Promise<ReplayResult> {
  try {
    const { data: results } = await octokit.rest.search.issuesAndPullRequests({
      q: `repo:${owner}/${repo} is:pr "${sessionId}" in:comments -number:${prNumber}`,
    });

    if (results.total_count > 0) {
      const otherPRs = results.items
        .map((i: any) => `#${i.number}`)
        .join(", ");
      return {
        isReplay: true,
        detail: `Session ID found in other PRs: ${otherPRs}`,
      };
    }

    return { isReplay: false };
  } catch (error: any) {
    core.warning(
      `Replay check failed: ${error.message}. Skipping replay detection.`,
    );
    return {
      isReplay: false,
      detail: "Replay check skipped due to API error",
    };
  }
}
