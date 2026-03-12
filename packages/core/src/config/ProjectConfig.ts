import { z } from "zod";

export const ProjectConfigSchema = z.object({
  version: z.literal(1),
  remote: z.string(),
  initialized_at: z.string(),
  signing_method: z.enum(["gpg", "ssh", "auto", "none"]).default("auto"),
  hooks: z.object({
    pre_push: z.boolean().default(false),
    post_commit: z.boolean().default(false),
  }),
  base_branch: z.string().default("main"),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
