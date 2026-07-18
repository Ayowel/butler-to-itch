import * as crypto from 'crypto';
import * as fspromises from 'fs/promises';
import * as fs from 'fs';
import * as glob from 'glob';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as cp from 'child_process';

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import { CommandInstallOptions, CommandOptions, CommandPushOptions } from './models';
import { getButlerOsPath } from './utils';

export class ButlerExecutor {
  private install_dir: string;

  public constructor(opts: CommandOptions) {
    this.install_dir = opts.install_dir;
  }

  public async install(opts: CommandInstallOptions) {
    core.startGroup('Install Butler');
    const download_url = this.getInstallUrl(opts.butler_source, opts.butler_version);
    core.info(`Downloading Butler from ${download_url}`);
    const downloaded_path = await tc.downloadTool(download_url);
    await this.validateChecksum(downloaded_path, opts.checksum);
    await fspromises.mkdir(this.install_dir, { recursive: true });
    core.info(`Extracting Butler to ${this.install_dir}`);
    await tc.extractZip(downloaded_path, this.install_dir);
    if (opts.update_path) {
      core.info('Adding Butler to PATH');
      core.addPath(this.install_dir);
    }
    core.endGroup();
  }

  public async validateChecksum(path: string, alg_hash: string) {
    if (alg_hash) {
      const [hash_type, hash] = alg_hash.split(':');
      const cryptohash = crypto.createHash(hash_type);
      cryptohash.setEncoding('hex');
      cryptohash.write(await fspromises.readFile(path));
      cryptohash.end();
      const calc_hash = cryptohash.read();
      if (calc_hash === hash) {
        core.debug(`Got expected hash value ${calc_hash}`);
      } else {
        const message = `Unexpected hash ${hash_type}:${calc_hash} instead of ${hash_type}:${hash}`;
        core.error(message);
        throw Error(message);
      }
    }
  }

  public async push(opts: CommandPushOptions) {
    /* Build file list by resolving globs */
    core.startGroup('Push files');
    const effective_files: { [id: string]: string[] } = {};
    for (const pair of opts.files) {
      const matched_paths = await glob.glob(pair[1]);
      if (matched_paths.length == 0) {
        throw Error(`Could not find any file with: ${pair[0]} ${pair[1]}`);
      }
      effective_files[pair[0]] = (effective_files[pair[0]] || []).concat(matched_paths);
    }

    /* Validate file channels */
    const pushed_channeled_files: { [id: string]: string } = {};
    const pushed_channelless_files: string[] = [];
    for (const base_channel in effective_files) {
      for (const file of effective_files[base_channel]) {
        let channel = base_channel;
        if (!channel) {
          if (opts.auto_channel) {
            channel = this.detectFileChannels(file);
          }
        }
        if (channel) {
          if (channel in pushed_channeled_files) {
            throw Error(
              util.format(
                'Attempting to push more than one file on channel %s (current: %s, previous: %s)',
                channel,
                file,
                pushed_channeled_files[channel]
              )
            );
          }
          core.info(`The file ${file} will be pushed to the channel ${channel}.`);
          pushed_channeled_files[channel] = file;
        } else {
          core.info(`The file ${file} will be pushed without a channel.`);
          core.error(`Files should not be pushed without a channel, but this one will: ${file}`);
          pushed_channelless_files.push(file);
        }
      }
    }

    /* Start upload */
    core.debug(`Starting uploads.`);
    const push_promises: Promise<any>[] = [];
    for (const channel in pushed_channeled_files) {
      push_promises.push(
        this.pushFile(
          opts.butler_key,
          opts.itch_user,
          opts.itch_game,
          opts.version,
          channel,
          pushed_channeled_files[channel]
        )
      );
    }
    push_promises.push(
      ...pushed_channelless_files.map(f =>
        this.pushFile(opts.butler_key, opts.itch_user, opts.itch_game, opts.version, '', f)
      )
    );
    await Promise.all(push_promises).then(v => {
      core.info('All files are pushed to Itch.');
      core.endGroup();
      return v;
    });
  }

  public async pushFile(
    key: string,
    user: string,
    game: string,
    version: string,
    channel: string,
    file: string
  ) {
    return new Promise<void>((resolve, reject) => {
      const target = `${user}/${game}:${channel}`;
      const push_args = ['push', file, target];
      if (version) {
        push_args.push('--userversion', version);
      }

      let stdout = '';
      let stderr = '';
      core.debug(`Spawn process with "${this.getExecutablePath()}" ${push_args}`);
      const child = cp.spawn(this.getExecutablePath(), push_args, {
        env: {
          BUTLER_API_KEY: key
        }
      });
      child.stdout.on('data', data => {
        stdout += data;
      });
      child.stderr.on('data', data => {
        stderr += data;
      });
      child.on('close', status => {
        let log = core.debug;
        if (status == 0) {
          core.info(`${child.pid} Pushed ${file} to ${target}`);
        } else {
          log = core.error;
          core.error(`${child.pid} Failed to push ${file} to ${target}\n`);
        }
        log(`${child.pid} ${stdout.split('\n').join(`\n${child.pid} `)}`);
        log(`${child.pid} ${stderr.split('\n').join(`\n${child.pid} `)}`);
        if (status == 0) {
          resolve();
        } else {
          reject(Error(`${child.pid} Failed to push ${file} to ${target}`));
        }
      });
    });
  }

  public isInstalled(): boolean {
    return fs.existsSync(this.getExecutablePath());
  }

  protected detectFileChannels(file: string): string {
    file = path.basename(file);
    const res: string[] = [];
    const mappings: { [key: string]: string[] } = {
      doc: ['doc', 'docs', 'documentation'],
      web: ['web', 'html', 'html5'],
      android: ['android', 'mobile'],
      linux: ['linux', 'unix', 'gnu', 'linuxbsd'],
      mac: ['mac', 'macintosh', 'macos', 'macosx', 'osx'],
      windows: ['win', 'windows', 'xp'],
      bsd: ['bsd', 'linuxbsd', 'freebsd'],
      amd: ['amd(?!64)'],
      amd64: ['amd64'],
      armv7: ['armv7'],
      arm64: ['arm64'],
      arm: ['arm'],
      ppc64le: ['ppc64le'],
      ppc64: ['ppc64'],
      s390x: ['s390x'],
      x32: ['x32', 'i[0-9]+86'],
      x64: ['x64', 'x86_64']
    };
    for (const key in mappings) {
      const rule = RegExp(`(^|[._-])(${mappings[key].join('|')})[._-]`, 'i');
      if (rule.test(file)) {
        res.push(key);
      }
    }
    return res.join('-');
  }

  protected getInstallUrl(source: string, version: string): string {
    return `${source}/${getButlerOsPath()}/${version.toUpperCase()}/archive/default`;
  }

  protected getExecutablePath(): string {
    let executable_name = 'butler';
    if (os.platform() == 'win32') {
      executable_name += '.exe';
    }
    return path.join(this.install_dir, executable_name);
  }
}
