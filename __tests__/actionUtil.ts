import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { https } from 'follow-redirects';
import * as base_os from 'os';
import * as base_child_process from 'child_process';
import * as base_actions_core from '@actions/core';
import * as base_actions_tool_cache from '@actions/tool-cache';

function mock_os() {
  return jest.unstable_mockModule('os', () => ({
    ...base_os,
    platform: jest.fn(base_os.platform),
    arch: jest.fn(base_os.arch)
  }));
}

function mock_child_process() {
  return jest.unstable_mockModule('child_process', () => ({
    ...base_child_process,
    spawn: jest.fn(base_child_process.spawn)
  }));
}

function mock_actions_core() {
  return jest.unstable_mockModule('@actions/core', () => ({
    ...base_actions_core,
    getInput: jest.fn((name: string, options?: { required?: boolean }) => {
      const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || '';
      if (options && options.required && !val) {
        throw new Error(`Input required and not supplied: ${name}`);
      }
      return val.trim();
    }),
    setOutput: jest.fn(base_actions_core.setOutput),
    addPath: jest.fn(base_actions_core.addPath),
    debug: jest.fn(base_actions_core.debug),
    error: jest.fn(base_actions_core.error)
  }));
}

const cache_dir = fs.mkdirSync('test_cache', { recursive: true }) || 'test_cache';

function mock_actions_tool_cache() {
  const actions_tool_cache = jest.unstable_mockModule('@actions/tool-cache', () => ({
    ...base_actions_tool_cache,
    downloadTool: async (url, dest) => {
      const filename = `${url.split('/').pop()}-${url
        .split('')
        .map(c => c.charCodeAt(0))
        .reduce((p, v) => p + v, 0)}`;
      const cache_path = path.join(cache_dir, filename);
      if (fs.existsSync(cache_path)) {
        if (dest) {
          fs.symlinkSync(dest, cache_path);
        } else {
          dest = cache_path;
        }
        return fs.realpathSync(dest);
      }
      return new Promise((resolve, reject) => {
        https.get(url, res => {
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
            resolve(fs.realpathSync(dest));
          });
        });
      });
    }
  }));
}

export { mock_actions_core, mock_actions_tool_cache, mock_child_process, mock_os };
