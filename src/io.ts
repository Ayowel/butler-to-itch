import * as os from 'os';
import * as path from 'path';
import * as util from 'util';

import * as core from '@actions/core';

import { CommandOptions, CommandOutputs } from './models';
import { stringToBool } from './utils';

export function parseInputs(): CommandOptions {
  const action = core.getInput('action');
  let install_dir = core.getInput('install_dir');
  if (!install_dir) {
    install_dir = path.join(os.homedir(), '.butler');
  }

  const opts: CommandOptions = {
    action,
    install_dir,
    install_opt: {
      butler_source: core.getInput('butler_source') || 'https://broth.itch.zone/butler',
      check_signature: stringToBool(core.getInput('check_signature'), true),
      update_path: stringToBool(core.getInput('update_path'), false),
      butler_version: core.getInput('butler_version') || 'latest'
    },
    push_opt: undefined
  };

  switch (action) {
    case 'install':
      break;
    case 'push':
      opts.push_opt = {
        butler_key: core.getInput('butler_key'),
        itch_user: core.getInput('itch_user'),
        itch_game: core.getInput('itch_game'),
        version: core.getInput('version'),
        auto_channel: stringToBool(core.getInput('auto_channel'), true),
        files: core
          .getInput('files')
          .split('\n')
          .map((v): [string, string] => {
            v = v.trim();
            let channel = '';
            let path = v;
            const splitted = v.split(' ');
            const first_item = splitted[0].toLowerCase();
            if (splitted.length > 1 && /^[a-z0-9-]+$/.test(first_item)) {
              const second_item = v.slice(first_item.length).trim();
              if (second_item) {
                channel = first_item;
                path = second_item;
              }
            }
            core.debug(`File input "${v}" mapped to channel "${channel}" with pattern "${path}"`);
            return [channel, path];
          })
          .filter(v => v[1])
      };
      if (!opts.push_opt.butler_key || !opts.push_opt.itch_user || !opts.push_opt.itch_game) {
        throw Error(
          util.format(
            'One of the following keys is required but not set: butler_key (%s), itch_user (%s), itch_game (%s).',
            opts.push_opt.butler_key,
            opts.push_opt.itch_user,
            opts.push_opt.itch_game
          )
        );
      }
      break;
    default:
      throw Error(util.format('Unknown action argument used (%s)', action));
  }

  return opts;
}

export function writeOutputs(outputs: CommandOutputs) {
  for (const i in outputs) {
    core.setOutput(i, outputs[i]);
  }
}
