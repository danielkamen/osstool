import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";
import { sessionCommand } from "./commands/session.js";
import { inspectCommand } from "./commands/inspect.js";
import { exportCommand } from "./commands/export.js";
import { attachCommand } from "./commands/attach.js";
import { hookCommand } from "./commands/hook.js";
import { doctorCommand } from "./commands/doctor.js";

yargs(hideBin(process.argv))
  .scriptName("provenance")
  .command(initCommand)
  .command(hookCommand)
  .command(inspectCommand)
  .command(sessionCommand)
  .command(exportCommand)
  .command(attachCommand)
  .command(doctorCommand)
  .demandCommand(1, "You must specify a command")
  .strict()
  .help()
  .version()
  .parse();
