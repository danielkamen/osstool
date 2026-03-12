import * as yaml from "yaml";
import { ProvenanceYmlSchema } from "./configSchema.js";
import type { ProvenanceYmlConfig } from "./configSchema.js";

export async function loadRepoConfig(
  octokit: any,
  owner: string,
  repo: string,
): Promise<ProvenanceYmlConfig | null> {
  try {
    const { data } = await (octokit as any).rest.repos.getContent({
      owner,
      repo,
      path: ".github/provenance.yml",
      ref: "HEAD",
    });

    if ("content" in data) {
      const content = Buffer.from(data.content as string, "base64").toString("utf-8");
      const parsed = yaml.parse(content);
      return ProvenanceYmlSchema.parse(parsed);
    }
    return null;
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}
