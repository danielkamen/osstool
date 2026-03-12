import type { CommandModule } from "yargs";
import { runPrePush } from "../hooks/prePushRunner.js";

const prePushCommand: CommandModule = {
  command: "pre-push",
  describe: false, // Hidden
  handler: async () => {
    try {
      await runPrePush(process.cwd());
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
          type: "session_start", // Re-use boundary event as commit marker
          timestamp: Date.now(),
          session_id: active.session_id,
          tool_version: "0.1.0",
          editor: "git-hook",
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
