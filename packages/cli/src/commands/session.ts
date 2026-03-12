import type { CommandModule } from "yargs";
import { SessionManager } from "@contrib-provenance/core";

interface StartArgs {
  name?: string;
  editor?: string;
}

interface EndArgs {
  session?: string;
}

interface CheckpointArgs {
  session?: string;
  editor?: string;
}

const startCommand: CommandModule<object, StartArgs> = {
  command: "start",
  describe: "Start a new tracking session",
  builder: (yargs) =>
    yargs
      .option("name", {
        type: "string",
        describe: "Human-readable session label",
      })
      .option("editor", {
        type: "string",
        describe: "Editor identifier (auto-detected when possible)",
      }),
  handler: async (argv) => {
    try {
      const { sessionId } = await SessionManager.startSession(process.cwd(), {
        editor: argv.editor,
      });
      console.log(`Session started: ${sessionId}`);
      console.log(
        "Tracking events. Run `provenance session end` when done.",
      );
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  },
};

const endCommand: CommandModule<object, EndArgs> = {
  command: "end",
  describe: "End the active tracking session",
  builder: (yargs) =>
    yargs.option("session", {
      type: "string",
      describe: "Session UUID (defaults to active session)",
    }),
  handler: async (argv) => {
    try {
      const metrics = await SessionManager.endSession(
        process.cwd(),
        argv.session,
      );
      console.log(`Session ended: ${metrics.session_id}`);
      console.log(`  Duration: ${metrics.dwell_minutes} min active editing`);
      console.log(`  Files: ${metrics.active_files} edited`);
      console.log(`  Entropy score: ${metrics.entropy_score}`);
      console.log(`  Edit displacement: ${metrics.edit_displacement_sum}`);
      console.log(`  Temporal jitter: ${metrics.temporal_jitter_ms} ms`);
      console.log(`  Test runs: ${metrics.test_runs_total} (${metrics.test_failures_observed} failed)`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  },
};

const checkpointCommand: CommandModule<object, CheckpointArgs> = {
  command: "checkpoint",
  describe: "Capture the current session and automatically start a new one",
  builder: (yargs) =>
    yargs
      .option("session", {
        type: "string",
        describe: "Session UUID (defaults to active session)",
      })
      .option("editor", {
        type: "string",
        describe: "Editor identifier for the new session",
      }),
  handler: async (argv) => {
    try {
      const result = await SessionManager.checkpointSession(process.cwd(), {
        sessionId: argv.session,
        editor: argv.editor,
      });
      console.log(`Session captured: ${result.endedSessionId}`);
      console.log(`  Duration: ${result.metrics.dwell_minutes} min active editing`);
      console.log(`  Files: ${result.metrics.active_files} edited`);
      console.log(`  Entropy score: ${result.metrics.entropy_score}`);
      console.log(`  Edit displacement: ${result.metrics.edit_displacement_sum}`);
      console.log(`  Temporal jitter: ${result.metrics.temporal_jitter_ms} ms`);
      console.log(`  Test runs: ${result.metrics.test_runs_total} (${result.metrics.test_failures_observed} failed)`);
      console.log("");
      console.log(`New session started: ${result.newSessionId}`);
      console.log("Tracking continues. Run `provenance export` when ready.");
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  },
};

export const sessionCommand: CommandModule = {
  command: "session",
  describe: "Manage tracking sessions",
  builder: (yargs) =>
    yargs
      .command(startCommand)
      .command(endCommand)
      .command(checkpointCommand)
      .demandCommand(1, "Specify a session subcommand: start, end, checkpoint"),
  handler: () => {},
};
