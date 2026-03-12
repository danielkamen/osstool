import * as vscode from "vscode";
import type { SessionTracker } from "./SessionTracker.js";
import type { StatusBarController } from "./StatusBarController.js";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  SessionStore,
  computeMetrics,
  getProvenanceDir,
  getSessionsDir,
  getAttestationsDir,
  getConfigPath,
  isoNow,
} from "@contrib-provenance/core";
import { getWorkspaceRoot } from "./EditorBridge.js";

export function registerCommands(
  context: vscode.ExtensionContext,
  tracker: SessionTracker,
  statusBar: StatusBarController,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("provenance.sessionStart", async () => {
      if (tracker.isTracking) {
        vscode.window.showInformationMessage("Provenance session is already active.");
        return;
      }
      try {
        const sessionId = await tracker.start();
        await statusBar.updateDisplay();
        vscode.window.showInformationMessage(
          `Provenance session started: ${sessionId.slice(0, 8)}...`,
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to start session: ${(err as Error).message}`,
        );
      }
    }),

    vscode.commands.registerCommand("provenance.sessionCheckpoint", async () => {
      if (!tracker.isTracking) {
        vscode.window.showWarningMessage("No active provenance session to checkpoint.");
        return;
      }
      try {
        const result = await tracker.checkpoint();
        await statusBar.updateDisplay();
        vscode.window.showInformationMessage(
          `Session captured: ${result.endedSessionId.slice(0, 8)}... ` +
          `(${result.metrics.dwell_minutes}m active, ${result.metrics.active_files} files). ` +
          `New session: ${result.newSessionId.slice(0, 8)}...`,
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Checkpoint failed: ${(err as Error).message}`,
        );
      }
    }),

    vscode.commands.registerCommand("provenance.sessionStatus", async () => {
      if (!tracker.isTracking) {
        vscode.window.showInformationMessage("No active provenance session.");
        return;
      }
      const metrics = await tracker.getMetrics();
      if (!metrics) {
        vscode.window.showInformationMessage("No metrics available yet.");
        return;
      }
      const items = [
        `Active editing: ${metrics.dwell_minutes} min`,
        `Files edited: ${metrics.active_files}`,
        `Edit complexity: ${metrics.entropy_score}`,
        `Change spread: ${metrics.edit_displacement_sum}`,
        `Pace variation: ${metrics.temporal_jitter_ms}ms`,
        `Test runs: ${metrics.test_runs_total} (${metrics.test_failures_observed} failed)`,
      ];
      vscode.window.showInformationMessage(items.join(" | "));
    }),

    vscode.commands.registerCommand("provenance.inspect", async () => {
      const wsRoot = getWorkspaceRoot();
      if (!wsRoot) return;

      const sessions = await SessionStore.listSessions(wsRoot);
      const ended = sessions
        .filter((s) => s.status === "ended" || s.status === "exported")
        .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""));

      if (ended.length === 0) {
        vscode.window.showInformationMessage("No completed sessions to inspect.");
        return;
      }

      const target = ended[0];
      const events = await SessionStore.readEvents(wsRoot, target.session_id);
      const metrics = computeMetrics(events, target.session_id);

      const output = vscode.window.createOutputChannel("Provenance Inspect");
      output.clear();
      output.appendLine(`Session: ${target.session_id}`);
      output.appendLine(`Status: ${target.status}`);
      output.appendLine(`Started: ${target.started_at}`);
      output.appendLine(`Ended: ${target.ended_at ?? "\u2014"}`);
      output.appendLine("");
      output.appendLine(`Active editing time: ${metrics.dwell_minutes} min`);
      output.appendLine(`Files edited: ${metrics.active_files}`);
      output.appendLine(`Edit complexity: ${metrics.entropy_score}`);
      output.appendLine(`Change spread: ${metrics.edit_displacement_sum}`);
      output.appendLine(`Pace variation: ${metrics.temporal_jitter_ms} ms`);
      output.appendLine(`Test runs: ${metrics.test_runs_total} (${metrics.test_failures_observed} failed)`);
      output.appendLine(`Test failure ratio: ${Math.round(metrics.test_failure_ratio * 100)}%`);
      output.show();
    }),

  );
}

export function registerInitCommand(
  context: vscode.ExtensionContext,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("provenance.init", async () => {
      const wsRoot = getWorkspaceRoot();
      if (!wsRoot) return;

      const provDir = getProvenanceDir(wsRoot);
      if (existsSync(join(provDir, "config.json"))) {
        vscode.window.showInformationMessage("Provenance is already initialized in this workspace.");
        return;
      }

      try {
        await mkdir(getSessionsDir(wsRoot), { recursive: true });
        await mkdir(getAttestationsDir(wsRoot), { recursive: true });
        await writeFile(
          join(provDir, ".gitignore"),
          "sessions/\nattestations/\ncheckpoint-*\n",
        );

        const config = {
          version: 1,
          remote: "unknown",
          initialized_at: isoNow(),
          signing_method: "auto",
          hooks: { pre_push: false, post_commit: false },
          base_branch: "main",
          init_mode: "minimal",
        };
        await writeFile(getConfigPath(wsRoot), JSON.stringify(config, null, 2));

        vscode.window.showInformationMessage(
          "Provenance initialized. Reload window to start tracking.",
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Failed to initialize provenance: ${(err as Error).message}`,
        );
      }
    }),
  );
}
