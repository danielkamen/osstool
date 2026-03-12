import { z } from "zod";

export const ProjectConfigSchema = z.object({
  version: z.literal(1),
  remote: z.string(),
  initialized_at: z.string(),
  signing_method: z.enum(["gpg", "ssh", "auto"]).default("auto"),
  hooks: z.object({
    pre_push: z.boolean().default(false),
  }),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
