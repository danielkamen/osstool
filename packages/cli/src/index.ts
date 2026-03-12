import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";
import { sessionCommand } from "./commands/session.js";
import { inspectCommand } from "./commands/inspect.js";
import { exportCommand } from "./commands/export.js";
import { attachCommand } from "./commands/attach.js";

yargs(hideBin(process.argv))
  .scriptName("provenance")
  .command(initCommand)
  .command(sessionCommand)
  .command(inspectCommand)
  .command(exportCommand)
  .command(attachCommand)
  .demandCommand(1, "You must specify a command")
  .strict()
  .help()
  .version()
  .parse();
