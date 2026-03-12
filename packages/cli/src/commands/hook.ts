import type { CommandModule } from "yargs";
import { runPrePush } from "../hooks/prePushRunner.js";
import { TOOL_VERSION } from "@contrib-provenance/core";

const prePushCommand: CommandModule = {
  command: "pre-push [remote] [url]",
  describe: false, // Hidden
  builder: (yargs) =>
    yargs
      .positional("remote", { type: "string", default: "origin" })
      .positional("url", { type: "string" }),
  handler: async (argv) => {
    try {
      await runPrePush(process.cwd(), argv.remote as string);
    } catch {
      // Never block push — swallow all errors
    }
    process.exit(0);
  },
};

const postCommitCommand: CommandModule = {
  command: "post-commit",
  describe: false, // Hidden
  handler: async () => {
    // Record a commit marker in the active VS Code session if present
    try {
      const { SessionStore } = await import("@contrib-provenance/core");
      const active = await SessionStore.findActiveSession(process.cwd());
      if (active) {
        await SessionStore.appendEvent(process.cwd(), active.session_id, {
          type: "commit_marker",
          timestamp: Date.now(),
          tool_version: TOOL_VERSION,
        });
      }
    } catch {
      // Silent — never interfere with git operations
    }
    process.exit(0);
  },
};

export const hookCommand: CommandModule = {
  command: "hook",
  describe: false, // Hidden from help
  builder: (yargs) =>
    yargs
      .command(prePushCommand)
      .command(postCommitCommand)
      .demandCommand(1),
  handler: () => {},
};
