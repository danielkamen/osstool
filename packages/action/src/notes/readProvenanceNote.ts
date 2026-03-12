import type { AttestationV1 } from "@contrib-provenance/core";
import { AttestationSchemaV1 } from "@contrib-provenance/core";
import { findAttestationInComments } from "../verification/verifyAttestation.js";

export async function readProvenanceNote(
  octokit: any,
  owner: string,
  repo: string,
  headSha: string,
): Promise<AttestationV1 | null> {
  try {
    // Try to fetch the provenance notes ref
    const { data: noteRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: "notes/provenance",
    });

    // Get the notes tree
    const { data: noteCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: noteRef.object.sha,
    });

    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: noteCommit.tree.sha,
      recursive: "true",
    });

    // Git notes store entries by the first 2 chars / remaining chars of the target SHA
    const prefix = headSha.slice(0, 2);
    const suffix = headSha.slice(2);
    const noteEntry = tree.tree.find(
      (entry: any) => entry.path === `${prefix}/${suffix}` || entry.path === headSha,
    );

    if (!noteEntry) return null;

    const { data: blob } = await octokit.rest.git.getBlob({
      owner,
      repo,
      file_sha: noteEntry.sha,
    });

    const content = Buffer.from(blob.content, blob.encoding).toString("utf-8");
    const parsed = JSON.parse(content);
    return AttestationSchemaV1.parse(parsed);
  } catch {
    return null;
  }
}

export async function findAttestation(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  headSha: string,
): Promise<AttestationV1 | null> {
  // 1. Try git notes first
  const fromNote = await readProvenanceNote(octokit, owner, repo, headSha);
  if (fromNote) return fromNote;

  // 2. Fall back to PR comments (backward compat)
  const allComments: any[] = [];
  let page = 1;
  while (true) {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
      page,
    });
    allComments.push(...comments);
    if (comments.length < 100) break;
    page++;
  }

  return findAttestationInComments(allComments);
}
