import * as vscode from "vscode";
import type { SessionTracker } from "./SessionTracker.js";

const TEST_PATTERNS: Array<{ pattern: RegExp; type: "test" | "lint" | "build" | "typecheck" }> = [
  { pattern: /^(npm|yarn|pnpm)\s+(test|run\s+test)/, type: "test" },
  { pattern: /^(jest|vitest|mocha|ava)/, type: "test" },
  { pattern: /^pytest/, type: "test" },
  { pattern: /^(cargo|go|gradle|mvn|dotnet)\s+test/, type: "test" },
  { pattern: /^make\s+(test|check)/, type: "test" },
  { pattern: /^(eslint|prettier)\b/, type: "lint" },
  { pattern: /^make\s+lint/, type: "lint" },
  { pattern: /^tsc\b/, type: "typecheck" },
  { pattern: /^(cargo|go)\s+build/, type: "build" },
  { pattern: /^(npm|yarn|pnpm)\s+run\s+build/, type: "build" },
  { pattern: /^make\s+build/, type: "build" },
];

export class TestRunWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private pendingTasks = new Map<string, "test" | "lint" | "build" | "typecheck">();

  constructor(private tracker: SessionTracker) {
    // Watch for VS Code task starts to record the command type
    this.disposables.push(
      vscode.tasks.onDidStartTask((e) => {
        this.onTaskStarted(e.execution.task);
      }),
    );

    // Watch for task process end to capture exit code
    this.disposables.push(
      vscode.tasks.onDidEndTaskProcess((e) => {
        this.onTaskEnded(e.execution.task, e.exitCode);
      }),
    );

    // Watch for terminal creation (terminal names often indicate the command)
    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        this.checkTerminalName(terminal.name);
      }),
    );
  }

  private onTaskStarted(task: vscode.Task): void {
    const name = task.name.toLowerCase();
    const commandType = this.matchCommand(name);
    if (commandType) {
      this.pendingTasks.set(task.name, commandType);
    }
  }

  private onTaskEnded(task: vscode.Task, exitCode: number | undefined): void {
    const commandType = this.pendingTasks.get(task.name);
    if (commandType) {
      this.pendingTasks.delete(task.name);
      const passed = exitCode !== undefined ? exitCode === 0 : null;
      this.tracker.recordTestRun(commandType, passed);
    }
  }

  private checkTerminalName(name: string): void {
    const commandType = this.matchCommand(name.toLowerCase());
    if (commandType) {
      // Terminal-only runs: no exit code available at open time
      this.tracker.recordTestRun(commandType, null);
    }
  }

  private matchCommand(text: string): "test" | "lint" | "build" | "typecheck" | null {
    for (const { pattern, type } of TEST_PATTERNS) {
      if (pattern.test(text)) {
        return type;
      }
    }
    return null;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
