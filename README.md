# Butler to Itch

[![License](https://img.shields.io/github/license/Ayowel/butler-to-itch)](https://github.com/Ayowel/butler-to-itch/blob/master/LICENSE)
[![Latest version](https://img.shields.io/github/v/tag/Ayowel/butler-to-itch)](https://www.github.com/Ayowel/butler-to-itch/releases/latest)

This action installs Butler and uses it to push assets to itch.io

## Usage

Your Butler key should be saved as a secret.

### Release a project

This example pushes 5 files to Itch, each in a dedicated channel.

```yml
# We have the following files in ./build:
# release-linux.tar.gz, release-windows.zip,
# release-mac.zip, java-release.apk
- uses: Ayowel/butler-to-itch@v1
  with:
    butler_key: ${{ secrets.BUTLER_CREDENTIALS }}
    itch_user: Ayowel
    itch_game: renpy-extensions-demo
    version: ${{ github.ref_name }}
    files: |
              build/release-*
      doc    docs/html
      mobile build/java-*
```

## Inputs

Generic parameters:

| Parameter | Description | Default |
| --------- | ----------- | ------- |
| **action** | Whether to `install` Butler or to `push` a file. | `'push'` |
| **install_dir** | Install Butler to a custom location. | `~/.butler` |
| **butler_source** | Where Butler should be download from. | `'https://broth.itch.zone/butler'` |

Push parameters:

| Parameter | Description | Default |
| --------- | ----------- | ------- |
| **butler_key** | Your butler key (see https://itch.io/user/settings/api-keys). | `""` |
| **itch_user** | The itch username of the user that distributes the game. | `""` |
| **itch_game** | The name of the game in the project's url. | `""` |
| **version** | The game's version number. | `""` |
| **files** | The files to push to itch. File paths support globing and may start with a channel name. | `""` |
| **auto_channel** | If no channel is provided for a file, generate one from the file's name (see "Behavior of auto_channel" below). | `true` |

Install parameters:

| Parameter | Description | Default |
| --------- | ----------- | ------- |
| **checksum** | The expected checksum of the downloaded Butler archive in the `alg:hash` format (e.g.: `sha256:01233456789abcdef`). | `""` |
| **update_path** | Whether to update the PATH variable to include Butler's install directory. | `false` |
| **butler_version** | Which Butler version to install. | `'latest'` |

## Outputs

| Output name | Description |
| :---: | :--- |
| __`install_dir`__ | Path to Butler's install directory |

## Implementation details

### Behavior of auto_channel

`auto_channel` parses the file name to build a channel string.

| Channel | Matched strings |
| :---: | :--- |
| doc | `doc`, `docs`, `documentation` |
| web | `web`, `html`, `html5` |
| android | `android`, `mobile` |
| linux | `linux`, `unix`, `gnu`, `linuxbsd` |
| mac | `mac`, `macintosh`, `macos`, `macosx`, `osx` |
| windows | `win`, `windows`, `xp` |
| bsd | `bsd`, `linuxbsd`, `freebsd` |
| amd | `amd(?!64)` |
| amd64 | `amd64` |
| armv7 | `armv7` |
| arm64 | `arm64` |
| arm | `arm` |
| ppc64le | `ppc64le` |
| ppc64 | `ppc64` |
| s390x | `s390x` |
| x32 | `x32', 'i[0-9]+86` |
| x64 | `x64', 'x86_64` |

* If more than one channel string matches, the resulting channel is all maches separated by a "`-`".
* String matching is case-insensitive
* Strings match only if the string is delimited by `.`, `_`, `-`, or the start of the filename.

### Channel names in `files`

Channel names in the `files` input field may only contain lowercase alphanumerical characters and hyphens, or they won't be recognized as such.
