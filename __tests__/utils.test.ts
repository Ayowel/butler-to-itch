import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { mock_os } from './actionUtil';

mock_os();

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
  ])('utils.string_to_bool("%s", %s) -> %s', async (str, def, result) => {
    const utils = await import('../src/utils');
    expect(utils.stringToBool(str, def)).toBe(result);
  });
});

describe('isStringToBoolThrowing', () => {
  it.each([
    ['0', true],
    ['1', false],
    ['tru', true],
    ['fals', false]
  ])('utils.string_to_bool("%s", %s) throws', async (str, def) => {
    const utils = await import('../src/utils');
    expect(() => utils.stringToBool(str, def)).toThrow();
  });
});

describe('isGetButlerOsPathFunctional', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const test_working: [NodeJS.Platform, string, string][] = [
    ['linux', 'x64', 'linux-amd64'],
    ['darwin', 'x64', 'darwin-amd64'],
    ['win32', 'x32', 'windows-386'],
    ['darwin', 'arm64', 'darwin-arm64']
  ];
  it.each(test_working)('[%s,%s] utils.getButlerOsPath() -> %s', async (platform, arch, result) => {
    const os_import = await import('os');
    const utils = await import('../src/utils');
    (os_import.arch as jest.MockedFunction<typeof os_import.arch>).mockReturnValue(arch);
    (os_import.platform as jest.MockedFunction<typeof os_import.platform>).mockReturnValue(
      platform
    );
    expect(utils.getButlerOsPath()).toBe(result);
  });

  const test_throwing: [NodeJS.Platform, string][] = [['android', 'x64']];
  it.each(test_throwing)('[%s,%s] utils.getButlerOsPath() throws', async (platform, arch) => {
    const os_import = await import('os');
    const utils = await import('../src/utils');
    (os_import.arch as jest.MockedFunction<typeof os_import.arch>).mockReturnValue(arch);
    (os_import.platform as jest.MockedFunction<typeof os_import.platform>).mockReturnValue(
      platform
    );
    expect(() => utils.getButlerOsPath()).toThrow();
  });
});
