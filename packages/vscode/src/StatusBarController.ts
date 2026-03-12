import * as vscode from "vscode";
import type { SessionTracker } from "./SessionTracker.js";
import { STATUS_BAR_UPDATE_MS } from "@contrib-provenance/core";

export class StatusBarController implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private updateInterval: ReturnType<typeof setInterval> | undefined;

  constructor(private tracker: SessionTracker) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.updateDisplay();
    this.item.show();

    this.updateInterval = setInterval(() => this.updateDisplay(), STATUS_BAR_UPDATE_MS);
  }

  async updateDisplay(): Promise<void> {
    if (!this.tracker.isTracking) {
      this.item.text = "$(circle-outline) Provenance";
      this.item.tooltip = "Click to start a provenance session";
      this.item.command = "provenance.sessionStart";
      return;
    }

    try {
      const metrics = await this.tracker.getMetrics();
      if (metrics) {
        this.item.text = `$(pulse) Provenance: ${metrics.dwell_minutes}m`;
        this.item.tooltip = `Active: ${metrics.active_files} files, entropy: ${metrics.entropy_score}`;
        this.item.command = "provenance.sessionStatus";
      }
    } catch {
      this.item.text = "$(pulse) Provenance";
      this.item.command = "provenance.sessionStatus";
    }
  }

  showEnded(): void {
    this.item.text = "$(check) Provenance: Done";
    this.item.tooltip = "Session ended. Click for details.";
    this.item.command = "provenance.sessionStatus";
  }

  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.item.dispose();
  }
}
