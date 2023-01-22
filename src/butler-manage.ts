import * as core from '@actions/core';

import { ButlerExecutor } from './executor';
import { parseInputs, writeOutputs } from './io';

async function main() {
  try {
    /* Get inputs */
    const opts = parseInputs();

    /* Ensure that Butler is installed */
    const executor = new ButlerExecutor(opts);
    if (!executor.isInstalled()) {
      await executor.install(opts.install_opt);
    }

    /* Perform additional actions */
    switch (opts.action) {
      case 'install': // Done above
        break;
      case 'push':
        if (!opts.push_opt) {
          throw Error('Push options not set in push action');
        }
        await executor.push(opts.push_opt);
        break;
      default:
        throw Error(`Unsupported action ${opts.action}`);
    }

    writeOutputs({ install_dir: opts.install_dir });
  } catch (error) {
    core.setFailed(error as Error);
  }
}

main();
