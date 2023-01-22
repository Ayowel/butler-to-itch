import * as os from 'os';
import * as util from 'util';

export function stringToBool(value: string, default_value: boolean): boolean {
  if (!value) {
    return default_value;
  }
  if (!['true', 'false'].includes(value.toLowerCase())) {
    throw Error(
      util.format('Received an arbitrary string where a boolean was expected: %s', value)
    );
  }
  return value.toLowerCase() == 'true';
}

export function getButlerOsPath(): string {
  let platform = '';
  switch (os.platform()) {
    case 'win32':
      platform = 'windows';
    case 'darwin':
    case 'linux':
      platform ||= os.platform();
      switch (os.arch()) {
        case 'x32':
          return util.format('%s-%s', platform, '386');
        case 'x64':
          return util.format('%s-%s', platform, 'amd64');
        default:
          throw Error(util.format('Unknown OS architecture: %s', os.arch()));
      }
    default:
      throw Error(util.format('Unknown OS platform: %s', os.platform()));
  }
}
