import type { CommandModule } from "yargs";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import {
  SessionStore,
  SessionManager,
  computeMetrics,
  buildAttestation,
  signAttestation,
  discoverSigningKey,
  getProvenanceDir,
  getAttestationPath,
  getAttestationsDir,
  TOOL_VERSION,
} from "@contrib-provenance/core";
import { mkdir } from "node:fs/promises";
import { formatExport, formatUnsignedExport } from "../output/formatExport.js";

interface ExportArgs {
  session?: string;
  disclosure?: string;
  sign: boolean;
  key?: string;
  output?: string;
}

async function promptDisclosure(): Promise<string | null> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      "Did you use AI assistance? (optional, press Enter to skip): ",
      (answer) => {
        rl.close();
        resolve(answer.trim() || null);
      },
    );
  });
}

export const exportCommand: CommandModule<object, ExportArgs> = {
  command: "export",
  describe: "Export a signed attestation from a completed session",
  builder: (yargs) =>
    yargs
      .option("session", {
        type: "string",
        describe: "Session UUID (defaults to most recent ended session)",
      })
      .option("disclosure", {
        type: "string",
        describe: "AI disclosure note",
      })
      .option("sign", {
        type: "boolean",
        default: true,
        describe: "Sign the attestation (use --no-sign to skip)",
      })
      .option("key", {
        type: "string",
        describe: "Override signing key ID",
      })
      .option("output", {
        type: "string",
        describe: "Custom output path for the attestation file",
      }),
  handler: async (argv) => {
    const cwd = process.cwd();

    if (!existsSync(getProvenanceDir(cwd))) {
      console.error("Error: Not initialized. Run `provenance init` first.");
      process.exit(1);
    }

    // Find target session
    const sessions = await SessionStore.listSessions(cwd);
    let targetId: string;

    if (argv.session) {
      targetId = argv.session;
    } else {
      // Check for active session first — auto-checkpoint it
      const active = sessions.find((s) => s.status === "active");
      if (active) {
        console.log("Active session found — checkpointing...");
        const result = await SessionManager.checkpointSession(cwd, {
          sessionId: active.session_id,
        });
        targetId = result.endedSessionId;
        console.log(`Session captured: ${result.endedSessionId}`);
        console.log(`New session started: ${result.newSessionId}`);
        console.log("");
      } else {
        const ended = sessions
          .filter((s) => s.status === "ended")
          .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""));
        if (ended.length === 0) {
          console.error("Error: No sessions found. Start a session first with `provenance session start`.");
          process.exit(1);
        }
        targetId = ended[0].session_id;
      }
    }

    const meta = await SessionStore.readSessionMeta(cwd, targetId);

    if (meta.status === "active") {
      // Explicit session ID was passed and it's still active — checkpoint it
      console.log("Session still active — checkpointing...");
      const result = await SessionManager.checkpointSession(cwd, {
        sessionId: targetId,
      });
      targetId = result.endedSessionId;
      console.log(`New session started: ${result.newSessionId}`);
      console.log("");
    }

    if (meta.status === "exported") {
      console.error("Error: Session already exported.");
      process.exit(1);
    }

    // Compute metrics
    const events = await SessionStore.readEvents(cwd, targetId);
    const metrics = computeMetrics(events, targetId);

    // Disclosure
    let disclosure = argv.disclosure ?? null;
    if (!disclosure && process.stdin.isTTY) {
      disclosure = await promptDisclosure();
    }

    // Build attestation
    const unsigned = await buildAttestation({
      metrics,
      repoRoot: cwd,
      disclosure,
      toolVersion: TOOL_VERSION,
    });

    let outputPath = argv.output;
    if (!outputPath) {
      const dir = getAttestationsDir(cwd);
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
      outputPath = getAttestationPath(cwd, targetId);
    }

    if (!argv.sign) {
      // Unsigned attestation
      const attestation = {
        ...unsigned,
        signature: "",
        signature_format: "gpg" as const,
      };
      await writeFile(outputPath, JSON.stringify(attestation, null, 2));
      await SessionStore.updateSessionMeta(cwd, targetId, { status: "exported" });
      console.log(formatUnsignedExport(attestation));
      return;
    }

    // Signing
    let method: "gpg" | "ssh";
    let keyId: string;

    if (argv.key) {
      // Try to detect method from key
      method = argv.key.endsWith(".pub") ? "ssh" : "gpg";
      keyId = argv.key;
    } else {
      try {
        const keyInfo = await discoverSigningKey(cwd);
        method = keyInfo.method;
        keyId = keyInfo.keyId;
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        console.error("Use --no-sign to export without signing.");
        process.exit(1);
      }
    }

    console.log(`Signing with ${method.toUpperCase()}...`);

    try {
      const attestation = await signAttestation(unsigned, method, keyId);
      await writeFile(outputPath, JSON.stringify(attestation, null, 2));
      await SessionStore.updateSessionMeta(cwd, targetId, { status: "exported" });
      console.log(formatExport(attestation));
    } catch (err) {
      console.error(`Signing failed: ${(err as Error).message}`);
      console.error("Check your signing key configuration or use --no-sign.");
      process.exit(1);
    }
  },
};
