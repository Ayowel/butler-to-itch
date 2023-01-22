import fs from 'fs';
import yaml from 'js-yaml';
import * as core from '@actions/core';
import * as io from '../src/io';

afterEach(() => {
  jest.resetAllMocks();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

const action_info = fs.readFileSync('action.yml', { encoding: 'utf-8' });

describe('IsInputParserWorking', () => {
  let core_input: { [id: string]: string } = {};
  beforeEach(() => {
    const action_yml = yaml.load(action_info) as { inputs: { [id: string]: { default?: string } } };
    core_input = {};
    for (const k in action_yml.inputs) {
      core_input[k] = action_yml.inputs[k]['default'] || '';
    }
    const spyCoreGetInput = jest.spyOn(core, 'getInput');
    spyCoreGetInput.mockImplementation(key => core_input[key] || '');
  });

  it('Simple action read (install)', () => {
    core_input.action = 'install';
    core_input.butler_version = ''; // default to 'latest' if not provided
    const opts = io.parseInputs();
    expect(opts.action).toBe('install');
    expect(opts.install_opt.butler_version).toBe('latest');
  });

  it('Unknown action read (qwerty)', () => {
    core_input.action = 'qwerty';
    expect(() => io.parseInputs()).toThrow();
  });

  it('Insufficient push options', () => {
    core_input.action = 'push';
    core_input.itch_user = 'USER';
    expect(() => io.parseInputs()).toThrow();
  });

  it('Split file path parser options', () => {
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
  let spyCoreSetOutput: jest.SpyInstance<void, [name: string, value: any]>;
  beforeEach(() => {
    const action_yml = yaml.load(action_info) as { inputs: { [id: string]: { default?: string } } };
    spyCoreSetOutput = jest.spyOn(core, 'setOutput');
  });

  it('Test output writer', () => {
    io.writeOutputs({ install_dir: 'path/to/dir' });
    expect(spyCoreSetOutput).toBeCalledWith('install_dir', 'path/to/dir');
  });
});
