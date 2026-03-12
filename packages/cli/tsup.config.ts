import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/postinstall.ts"],
    format: ["cjs"],
    dts: false,
  },
]);
