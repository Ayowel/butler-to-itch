export type CommandOptions = {
  // Commont information
  action: string;
  install_dir: string;

  install_opt: CommandInstallOptions;
  push_opt: CommandPushOptions | undefined;
};

export type CommandInstallOptions = {
  butler_source: string;
  check_signature: boolean;
  update_path: boolean;
  butler_version: string;
};

export type CommandPushOptions = {
  butler_key: string;
  itch_user: string;
  itch_game: string;
  version: string;

  files: [string, string][];
  auto_channel: boolean;
};

export type CommandOutputs = {
  [id: string]: string;
};
