import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"],
    dts: true,
    noExternal: ["@contrib-provenance/core"],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/postinstall.ts"],
    format: ["cjs"],
    dts: false,
    noExternal: ["@contrib-provenance/core"],
  },
]);
