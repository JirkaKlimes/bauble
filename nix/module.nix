self:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.bauble;
  inherit (lib) mkOption types;

  app = "${cfg.package}/share/bauble";
  pocketbase = lib.getExe cfg.pocketbase;

  pbFlags = [
    "--dir=${cfg.dataDir}/pb_data"
    "--hooksDir=${app}/pb_hooks"
    "--migrationsDir=${app}/pb_migrations"
    "--publicDir=${app}/pb_public"
    "--automigrate=false"
    "--hooksWatch=false"
  ];

  environment = {
    TZ = cfg.timeZone;
    BAUBLE_URL = cfg.url;
    BAUBLE_PREVIEW_BLOCK = lib.concatStringsSep "," cfg.previewBlocklist;
  };

  # Link previews fetch user-supplied URLs. PocketBase follows redirects and
  # resolves DNS without any hook, so private ranges are blocked here, at the
  # socket. Loopback stays open because cloudflared or the reverse proxy
  # connects over it.
  privateRanges = [
    "0.0.0.0/8"
    "10.0.0.0/8"
    "100.64.0.0/10"
    "169.254.0.0/16"
    "172.16.0.0/12"
    "192.0.0.0/24"
    "192.168.0.0/16"
    "198.18.0.0/15"
    "224.0.0.0/3"
    "fc00::/7"
    "fe80::/10"
    "ff00::/8"
  ];

  ctl = pkgs.writeShellApplication {
    name = "bauble-ctl";
    runtimeInputs = [ pkgs.util-linux ];
    text = ''
      if [ "$(id -u)" -ne 0 ]; then
        echo "bauble-ctl: run as root (sudo bauble-ctl ...)" >&2
        exit 1
      fi
      exec runuser -u bauble -- env ${
        lib.escapeShellArgs (lib.mapAttrsToList (k: v: "${k}=${v}") environment)
      } ${pocketbase} ${lib.escapeShellArgs pbFlags} "$@"
    '';
  };
in
{
  options.services.bauble = {
    enable = lib.mkEnableOption "bauble, the family wish list";

    package = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
      defaultText = lib.literalExpression "bauble.packages.\${system}.default";
      description = "The bauble app: static site, PocketBase hooks and migrations.";
    };

    pocketbase = lib.mkPackageOption pkgs "pocketbase" { };

    url = mkOption {
      type = types.str;
      example = "https://bauble.example.com";
      description = "Public URL of the site. Used in invite links.";
    };

    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "Listen address. Keep it on loopback behind cloudflared or a reverse proxy.";
    };

    port = mkOption {
      type = types.port;
      default = 8090;
      description = "Listen port.";
    };

    dataDir = mkOption {
      type = types.path;
      default = "/var/lib/bauble";
      description = "State directory. The SQLite database and uploaded photos live in `pb_data/` inside it. Back it up.";
    };

    timeZone = mkOption {
      type = types.str;
      default = if config.time.timeZone != null then config.time.timeZone else "UTC";
      defaultText = lib.literalExpression ''config.time.timeZone or "UTC"'';
      description = "Time zone for occasion dates. Gifts are revealed at local midnight after the occasion.";
    };

    previewBlocklist = mkOption {
      type = types.listOf types.str;
      default = [ ];
      example = [ "home.example.com" ];
      description = ''
        Host suffixes that link previews must never fetch, for names that
        resolve to internal services. Private address ranges are always
        blocked at the socket level.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = lib.versionAtLeast cfg.pocketbase.version "0.39";
        message = "services.bauble needs PocketBase 0.39 or newer, got ${cfg.pocketbase.version}. Set services.bauble.pocketbase to a newer package.";
      }
    ];

    users.users.bauble = {
      isSystemUser = true;
      group = "bauble";
      home = cfg.dataDir;
    };
    users.groups.bauble = { };

    systemd.tmpfiles.settings."10-bauble".${cfg.dataDir}.d = {
      user = "bauble";
      group = "bauble";
      mode = "0750";
    };

    systemd.services.bauble = {
      description = "bauble family wish list";
      wantedBy = [ "multi-user.target" ];
      wants = [ "network-online.target" ];
      after = [ "network-online.target" ];
      inherit environment;

      serviceConfig = {
        ExecStart = "${pocketbase} serve --http=${cfg.host}:${toString cfg.port} ${lib.escapeShellArgs pbFlags}";
        User = "bauble";
        Group = "bauble";
        WorkingDirectory = cfg.dataDir;
        ReadWritePaths = [ cfg.dataDir ];
        Restart = "on-failure";
        RestartSec = 5;

        IPAddressDeny = privateRanges;
        MemoryMax = "512M";
        LimitNOFILE = 4096;

        UMask = "0027";
        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ProtectHostname = true;
        ProtectClock = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectKernelLogs = true;
        ProtectControlGroups = true;
        ProtectProc = "invisible";
        ProcSubset = "pid";
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
        ];
        LockPersonality = true;
        MemoryDenyWriteExecute = true;
        CapabilityBoundingSet = "";
        SystemCallArchitectures = "native";
        SystemCallFilter = [
          "@system-service"
          "~@privileged"
        ];
      };
    };

    environment.systemPackages = [ ctl ];
  };
}
