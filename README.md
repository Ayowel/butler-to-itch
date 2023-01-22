# Ren'Py installer

[![License](https://img.shields.io/github/license/Ayowel/butler-to-itch)](https://github.com/Ayowel/butler-to-itch/blob/master/LICENSE)
[![Latest version](https://img.shields.io/github/v/tag/Ayowel/butler-to-itch)](https://www.github.com/Ayowel/butler-to-itch/releases/latest)

This action installs Butler and uses it to push assets to itch.io

## Inputs

The step configuration looks like this:

```yml
- uses: Ayowel/butler-to-itch@v0.1.0
  with:
    # Whether to install Butler or to push a file.
    # This may be used when you want to use Butler with custom
    # commands.
    action: "push"
    # Where Butler should be installed.
    install_dir: ~/.butler

    ###### Push options ######
    # Your butler key (see https://itch.io/user/settings/api-keys)
    butler_key: ""
    # The itch username of the user that distributes the game
    itch_user: ""
    # The name of the game in the project's url
    itch_game: ""
    # The game version number
    version: ""
    # The files to push to itch.
    # File paths support globing and may start with a channel name.
    files: ""
    # If no channel is provided for a file, to generate one from the
    # file's name.
    auto_channel: true

    ###### Install options ######
    # Whether to verify the downloaded Butler archive's signature
    check_signature: true
    # Whether to update the PATH variable to include Butler's
    # install directory
    update_path: false
    # Which Butler version to install
    butler_version: "latest"
```

## Outputs

| Output name | Description |
| :---: | :--- |
| __`install_dir`__ | Path to Butler's install directory |

## Usage

For best performance, we recommend to cache Butler's directory.
Your Butler key `MUST` be saved as a secret so as to not appear in your project's repository.

### Release a project

```yml
# .github/workflows/release.yml
name: Release project
on:
  workflow_dispatch:

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
        with:
          path: project
      - uses: actions/cache@v3
        with:
          path: butler
          key: ${{ runner.os }}-butler
      - uses: Ayowel/butler-to-itch@v0.1.0
        with:
          install_dir: butler
          butler_key: ${{ secrets.BUTLER_CREDENTIALS }}
          itch_user: Ayowel
          itch_game: renpy-extensions-demo
          version: ${{ github.ref_name }}
          # We assume that we have the following files in project/build:
          # release-linux.tar.gz, release-windows.zip,
          # release-mac.zip, java-release.apk
          files: |
                   project/build/release-*
            doc    project/docs/html
            mobile project/build/java-*
```
