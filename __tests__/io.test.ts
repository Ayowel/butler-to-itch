import fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { mock_actions_core } from './actionUtil';

mock_actions_core();

afterEach(() => {
  jest.resetAllMocks();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('IsInputParserWorking', () => {
  let core_input: { [id: string]: string } = {};
  let action_yml: { inputs: { [id: string]: { default?: string } } };

  beforeAll(async () => {
    const action_template = await fs.readFile('action.yml', { encoding: 'utf-8' });
    action_yml = yaml.load(action_template) as typeof action_yml;
  });

  beforeEach(async () => {
    const core = await import('@actions/core');
    core_input = {};
    for (const k in action_yml.inputs) {
      core_input[k] = action_yml.inputs[k]['default'] || '';
    }
    (core.getInput as jest.Mock<typeof core.getInput>).mockImplementation(
      key => core_input[key] || ''
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Simple action read (install)', async () => {
    const io = await import('../src/io');
    core_input.action = 'install';
    core_input.butler_version = ''; // default to 'latest' if not provided
    const opts = io.parseInputs();
    expect(opts.action).toBe('install');
    expect(opts.install_opt.butler_version).toBe('latest');
  });

  it('Unknown action read (qwerty)', async () => {
    const io = await import('../src/io');
    core_input.action = 'qwerty';
    expect(() => io.parseInputs()).toThrow();
  });

  it('Insufficient push options', async () => {
    const io = await import('../src/io');
    core_input.action = 'push';
    core_input.itch_user = 'USER';
    expect(() => io.parseInputs()).toThrow();
  });

  it('Split file path parser options', async () => {
    const io = await import('../src/io');
    core_input.action = 'push';
    core_input.butler_key = 'XXXX';
    core_input.itch_user = 'USER';
    core_input.itch_game = 'GAMER';
    core_input.files = [
      '  ',
      ' test  path/to/file.zip ',
      ' path/to/file.zip ',
      ' path/to/fi le.zip ',
      ' win to/fi le.zip '
    ].join('\n');

    const opts = io.parseInputs();
    expect(opts.push_opt?.files).toEqual([
      ['test', 'path/to/file.zip'],
      ['', 'path/to/file.zip'],
      ['', 'path/to/fi le.zip'],
      ['win', 'to/fi le.zip']
    ]);
  });
});

describe('IsOutputWriterWorking', () => {
  it('Test output writer', async () => {
    const core = await import('@actions/core');
    const io = await import('../src/io');
    io.writeOutputs({ install_dir: 'path/to/dir' });
    expect(core.setOutput).toHaveBeenCalledWith('install_dir', 'path/to/dir');
  });
});
