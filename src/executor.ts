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
    const download_url = this.getInstallUrl(opts.butler_version);
    core.info(`Downloading Butler from ${download_url}`);
    const downloaded_path = await tc.downloadTool(download_url);
    fs.mkdirSync(this.install_dir, { recursive: true });
    core.info(`Extracting Butler to ${this.install_dir}`);
    await tc.extractZip(downloaded_path, this.install_dir);
    if (opts.check_signature) {
      core.error('Butler archive signature verification is not supported yet.');
    }
    if (opts.update_path) {
      core.info('Adding Butler to PATH');
      core.addPath(this.install_dir);
    }
    core.endGroup();
  }

  public async push(opts: CommandPushOptions) {
    /* Build file list by resolving globs */
    core.startGroup('Push files');
    const effective_files: { [id: string]: string[] } = {};
    for (const pair of opts.files) {
      util.promisify(glob.glob)(pair[1]);
      const matched_paths = glob.sync(pair[1]);
      if (matched_paths.length == 0) {
        throw Error(`Could not find any file with: ${pair[0]} ${pair[1]}`);
      }
      effective_files[pair[0]] = (effective_files[pair[0]] || []).concat(matched_paths);
    }

    /* Validate file channels */
    const pushed_channeled_files: { [id: string]: string } = {};
    const pushed_channelless_files = [];
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
      const push_args = ['push', file, `${user}/${game}:${channel}`];
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
          core.info(`${child.pid} Pushed ${file}`);
        } else {
          log = core.error;
          core.error(`${child.pid} Failed to push ${file}\n`);
        }
        log(`${child.pid} ${stdout.split('\n').join(`\n${child.pid} `)}`);
        log(`${child.pid} ${stderr.split('\n').join(`\n${child.pid} `)}`);
        if (status == 0) {
          resolve();
        } else {
          reject(Error(`${child.pid} Failed to push ${file}`));
        }
      });
    });
  }

  public isInstalled(): boolean {
    return fs.existsSync(this.getExecutablePath());
  }

  protected detectFileChannels(file: string): string {
    file = path.basename(file);
    const res = [];
    const mappings: { [key: string]: string[] } = {
      doc: ['doc', 'docs', 'documentation'],
      web: ['web', 'html', 'html5'],
      android: ['android', 'mobile'],
      linux: ['linux', 'unix', 'gnu'],
      mac: ['mac', 'macintosh', 'macos', 'macosx', 'osx'],
      windows: ['win', 'windows', 'xp'],
      x32: ['x32'],
      x64: ['x64']
    };
    for (const key in mappings) {
      const rule = RegExp(`(^|[._-])(${mappings[key].join('|')})[._-]`, 'i');
      if (rule.test(file)) {
        res.push(key);
      }
    }
    return res.join('-');
  }

  protected getInstallUrl(version: string): string {
    return util.format(
      'https://broth.itch.ovh/butler/%s/%s/archive/default',
      getButlerOsPath(),
      version.toUpperCase()
    );
  }

  protected getSignatureUrl(version: string): string {
    return util.format(
      'https://broth.itch.ovh/butler/%s/%s/signature/default',
      getButlerOsPath(),
      version.toUpperCase()
    );
  }

  protected getExecutablePath(): string {
    let executable_name = 'butler';
    if (os.platform() == 'win32') {
      executable_name += '.exe';
    }
    return path.join(this.install_dir, executable_name);
  }
}
