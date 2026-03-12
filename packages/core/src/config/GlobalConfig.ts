import { z } from "zod";

export const GlobalConfigSchema = z.object({
  version: z.literal(1),
  default_signing_method: z.enum(["gpg", "ssh", "auto"]).default("auto"),
  ai_disclosure_default: z.string().nullable().default(null),
  telemetry: z.boolean().default(false),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
