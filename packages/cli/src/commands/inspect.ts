import type { CommandModule } from "yargs";
import {
  SessionStore,
  computeMetrics,
  getProvenanceDir,
} from "@contrib-provenance/core";
import { existsSync } from "node:fs";
import { formatInspect, formatSessionList } from "../output/formatInspect.js";

interface InspectArgs {
  session?: string;
  json: boolean;
  all: boolean;
}

export const inspectCommand: CommandModule<object, InspectArgs> = {
  command: "inspect",
  describe: "Inspect a tracking session",
  builder: (yargs) =>
    yargs
      .option("session", {
        type: "string",
        describe: "Session UUID (defaults to most recent ended session)",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "Output raw JSON",
      })
      .option("all", {
        type: "boolean",
        default: false,
        describe: "List all sessions",
      }),
  handler: async (argv) => {
    const cwd = process.cwd();

    if (!existsSync(getProvenanceDir(cwd))) {
      console.error("Error: Not initialized. Run `provenance init` first.");
      process.exit(1);
    }

    const sessions = await SessionStore.listSessions(cwd);

    if (argv.all) {
      console.log(formatSessionList(sessions));
      return;
    }

    // Find target session
    let targetId: string;
    if (argv.session) {
      targetId = argv.session;
    } else {
      // Find most recent ended session
      const ended = sessions
        .filter((s) => s.status === "ended" || s.status === "exported")
        .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""));
      if (ended.length === 0) {
        console.error("Error: No ended sessions found.");
        process.exit(1);
      }
      targetId = ended[0].session_id;
    }

    const meta = await SessionStore.readSessionMeta(cwd, targetId);
    const events = await SessionStore.readEvents(cwd, targetId);
    const metrics = computeMetrics(events, targetId);

    if (argv.json) {
      console.log(JSON.stringify({ meta, metrics }, null, 2));
      return;
    }

    console.log(formatInspect(meta, metrics, events));
  },
};
