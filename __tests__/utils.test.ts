import os from 'os';
import * as utils from '../src/utils';

describe('isStringToBoolWorking', () => {
  it.each([
    ['true', true, true],
    ['true', false, true],
    ['TrUe', false, true],
    ['false', true, false],
    ['false', false, false],
    ['FaLsE', true, false],
    ['', true, true],
    ['', false, false]
  ])('utils.string_to_bool("%s", %s) -> %s', (str, def, result) => {
    expect(utils.stringToBool(str, def)).toBe(result);
  });
});

describe('isStringToBoolThrowing', () => {
  it.each([
    ['0', true],
    ['1', false],
    ['tru', true],
    ['fals', false]
  ])('utils.string_to_bool("%s", %s) throws', (str, def) => {
    expect(() => utils.stringToBool(str, def)).toThrow();
  });
});

describe('isGetButlerOsPathFunctional', () => {
  let os_info: { platform: NodeJS.Platform; arch: string } = {
    platform: 'linux',
    arch: 'x32'
  };
  beforeEach(() => {
    const spyOsPlatform = jest.spyOn(os, 'platform');
    spyOsPlatform.mockImplementation(() => os_info.platform);
    const spyArch = jest.spyOn(os, 'arch');
    spyArch.mockImplementation(() => os_info.arch);
  });
  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const test_working: [NodeJS.Platform, string, string][] = [
    ['linux', 'x64', 'linux-amd64'],
    ['darwin', 'x64', 'darwin-amd64'],
    ['win32', 'x32', 'windows-386']
  ];
  it.each(test_working)('[%s,%s] utils.getButlerOsPath() -> %s', (platform, arch, result) => {
    os_info.arch = arch;
    os_info.platform = platform;
    expect(utils.getButlerOsPath()).toBe(result);
  });

  const test_throwing: [NodeJS.Platform, string][] = [
    ['android', 'x64'],
    ['darwin', 'arm']
  ];
  it.each(test_throwing)('[%s,%s] utils.getButlerOsPath() throws', (platform, arch) => {
    os_info.arch = arch;
    os_info.platform = platform;
    expect(() => utils.getButlerOsPath()).toThrow();
  });
});
