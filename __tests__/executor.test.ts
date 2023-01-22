import cp, { ChildProcess } from 'child_process';
import mockfs from 'mock-fs';
import fs from 'fs';
import { https } from 'follow-redirects';
import path from 'path';
import util from 'util';

import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as models from '../src/models';
import * as executor from '../src/executor';

jest.mock('@actions/core');

let tmpdir = '';
const cache_dir = fs.mkdirSync('test_cache', { recursive: true }) || 'test_cache';
let opts: models.CommandOptions;

beforeEach(async () => {
  tmpdir = await util.promisify(fs.mkdtemp)('jest-test-');
  opts = {
    action: 'push',
    install_dir: tmpdir,
    install_opt: {
      butler_version: 'latest',
      check_signature: false,
      update_path: false
    },
    push_opt: undefined
  };

  const spyTcDownloadTool = jest.spyOn(tc, 'downloadTool');
  spyTcDownloadTool.mockImplementation(async (url, dest) => {
    const filename = url.split('/').pop() as string;
    const cache_path = path.join(cache_dir, filename);
    if (fs.existsSync(cache_path)) {
      if (dest) {
        fs.symlinkSync(dest, cache_path);
      } else {
        dest = cache_path;
      }
      return util.promisify(fs.realpath)(dest);
    }
    return new Promise((resolve, reject) => {
      const req = https.get(url, res => {
        if (res.statusCode && res.statusCode >= 400) {
          reject('Received error code');
        }
        const filePath = fs.createWriteStream(cache_path);
        res.pipe(filePath);
        filePath.on('finish', async () => {
          filePath.close();
          if (dest) {
            fs.symlinkSync(dest, cache_path);
          } else {
            dest = cache_path;
          }
          resolve(await util.promisify(fs.realpath)(dest));
        });
      });
    });
  });
});

afterEach(async () => {
  await util.promisify(fs.rm)(tmpdir, { recursive: true });
  jest.resetAllMocks();
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('IsExecutorInstallWorking', () => {
  test('Install Butler to directory with signature and path update', async () => {
    opts.action = 'install';
    opts.install_opt.check_signature = true;
    opts.install_opt.update_path = true;

    const ex = new executor.ButlerExecutor(opts);
    expect(ex.isInstalled()).toBe(false);
    await expect(ex.install(opts.install_opt)).resolves.not.toThrow();
    expect(ex.isInstalled()).toBe(true);
    expect(fs.existsSync((ex as any).getExecutablePath())).toBe(true);
    expect(core.addPath).toHaveBeenCalled();
  });

  test('Install Butler to directory without signature and path update', async () => {
    opts.action = 'install';
    opts.install_opt.check_signature = false;
    opts.install_opt.update_path = false;

    const ex = new executor.ButlerExecutor(opts);
    expect(ex.isInstalled()).toBe(false);
    await expect(ex.install(opts.install_opt)).resolves.not.toThrow();
    expect(ex.isInstalled()).toBe(true);
    expect(fs.existsSync((ex as any).getExecutablePath())).toBe(true);
    expect(core.addPath).not.toHaveBeenCalled();
  });
});

describe('Is ButlerExecutor.pushFile working', () => {
  let spyCpSpawn: jest.SpyInstance<
    cp.ChildProcess,
    [command: string, args: readonly string[], options: cp.SpawnOptions]
  >;
  type procListMock = {
    stdout: {
      on: jest.Mock<void, [l: string, f: (d: any) => {}]>;
      cbs: [string, (d: any) => {}][];
    };
    stderr: {
      on: jest.Mock<void, [l: string, f: (d: any) => {}]>;
      cbs: [string, (d: any) => {}][];
    };
    on: jest.Mock;
    cbs: [string, (d: any) => {}][];
    pid: number | undefined;
  };
  let processList: procListMock[] = [];
  beforeEach(() => {
    processList = [];
    spyCpSpawn = jest.spyOn(cp, 'spawn');
    spyCpSpawn.mockImplementation((commands, args, opts) => {
      const proc: procListMock = {
        stdout: {
          on: jest.fn((l, f) => {
            proc.stdout.cbs.push([l, f]);
          }),
          cbs: []
        },
        stderr: {
          on: jest.fn((l, f) => {
            proc.stderr.cbs.push([l, f]);
          }),
          cbs: []
        },
        on: jest.fn((l, f) => {
          proc.cbs.push([l, f]);
        }),
        cbs: [],
        pid: undefined
      };

      processList.push(proc);
      return proc as unknown as ChildProcess;
    });
  });

  it.each([[0], [1]])(
    'ButlerExecutor.pushFile properly handles stdout, stderr, and retval(%s)',
    async retval => {
      const ex = new executor.ButlerExecutor(opts);
      const pushPromise = ex.pushFile(
        'BUTLER_KEY',
        'USER',
        'GAME',
        '0.1.0',
        'CHANNEL',
        'path/to/file'
      );
      expect(spyCpSpawn).toHaveBeenCalled();
      const p = processList[0];
      p.pid = 3;
      p.on();
      expect(p.stdout.on).toHaveBeenCalled();
      expect(p.stderr.on).toHaveBeenCalled();
      expect(p.stdout.cbs[0][0]).toBe('data');
      expect(p.stderr.cbs[0][0]).toBe('data');
      expect(p.cbs[0][0]).toBe('close');
      expect(() => p.stdout.cbs[0][1]('stdout text ')).not.toThrow();
      expect(() => p.stdout.cbs[0][1]('follow-up\nstdout text 2')).not.toThrow();
      expect(() => p.stderr.cbs[0][1]('stderr text')).not.toThrow();

      /* Close and check promise */
      expect(() => p.cbs[0][1](retval)).not.toThrow();
      if (retval == 0) {
        await expect(pushPromise).resolves.not.toThrow();
        expect(core.debug).toBeCalledWith('3 stdout text follow-up\n3 stdout text 2');
        expect(core.debug).toBeCalledWith('3 stderr text');
      } else {
        await expect(pushPromise).rejects.toThrow();
        expect(core.error).toBeCalledWith('3 stdout text follow-up\n3 stdout text 2');
        expect(core.error).toBeCalledWith('3 stderr text');
      }
    }
  );
});

describe('Is ButlerExecutor.push working', () => {
  const mockfs_files = {
    'game-linux-x64.release.zip': '',
    'game_Mac_release.zip': '',
    'game.WIN.release.zip': '',
    'android-release.zip': ''
  };
  beforeEach(() => {
    mockfs(mockfs_files);
  });
  afterEach(() => {
    mockfs.restore();
  });

  it.each([
    ['and*-release.zip', 'android-release.zip', 'android'],
    ['game-linux-x64.release.zip', 'game-linux-x64.release.zip', 'linux-x64']
  ])(
    "Ensure single file pattern '%s' maps to file %s with channel %s",
    async (file_pattern, effective_file, channel) => {
      const butler_key = 'XXX';
      const itch_game = 'GAME';
      const itch_user = 'USER';
      const version = '';
      opts.action = 'push';
      opts.push_opt = {
        auto_channel: true,
        butler_key,
        files: [['', file_pattern]],
        itch_game,
        itch_user,
        version
      };
      const ex = new executor.ButlerExecutor(opts);
      ex.pushFile = jest.fn(async (key, user, game, version, channel, file) => {});
      await expect(ex.push(opts.push_opt)).resolves.not.toThrow();
      expect(ex.pushFile).toBeCalledTimes(1);
      expect(ex.pushFile).toBeCalledWith(
        butler_key,
        itch_user,
        itch_game,
        version,
        channel,
        effective_file
      );
    }
  );

  it.each([
    ['*release.zip', 4],
    ['game*', 3],
    ['qwerty-*', 0]
  ])("Ensure file pattern '%s' maps to %s files", async (file_pattern, match_count) => {
    opts.action = 'push';
    opts.push_opt = {
      auto_channel: true,
      butler_key: 'XXX',
      files: [['', file_pattern]],
      itch_game: 'GAME',
      itch_user: 'USER',
      version: ''
    };

    const ex = new executor.ButlerExecutor(opts);
    ex.pushFile = jest.fn(async (key, user, game, version, channel, file) => {});
    if (match_count) {
      await expect(ex.push(opts.push_opt)).resolves.not.toThrow();
      expect(ex.pushFile).toBeCalledTimes(match_count);
    } else {
      await expect(ex.push(opts.push_opt)).rejects.toThrow();
    }
  });

  it.each([
    ['*release.zip', ['linux-x64', 'mac', 'windows', 'android']],
    ['game*', ['linux-x64', 'mac', 'windows']]
  ])("Ensure file pattern '%s' maps files to channels %s", async (file_pattern, channels) => {
    opts.action = 'push';
    opts.push_opt = {
      auto_channel: true,
      butler_key: 'XXX',
      files: [['', file_pattern]],
      itch_game: 'GAME',
      itch_user: 'USER',
      version: ''
    };
    const ex = new executor.ButlerExecutor(opts);
    const pushfile_mock = jest.fn(async (key, user, game, version, channel, file) => {});
    ex.pushFile = pushfile_mock;
    await expect(ex.push(opts.push_opt)).resolves.not.toThrow();
    const detected_channels = pushfile_mock.mock.calls.map(v => v[4]);
    for (const channel of channels) {
      expect(detected_channels).toContain(channel);
    }
  });
});
