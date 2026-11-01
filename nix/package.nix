{
  lib,
  buildNpmPackage,
  stdenvNoCC,
}:

let
  web = buildNpmPackage {
    pname = "bauble-web";
    version = "1.0.0";
    src = lib.fileset.toSource {
      root = ../web;
      fileset = lib.fileset.difference ../web (
        lib.fileset.unions (
          map lib.fileset.maybeMissing [
            ../web/e2e
            ../web/node_modules
            ../web/dist
          ]
        )
      );
    };
    npmDepsHash = "sha256-ckjbujf/RhaOW1c1+MjHqdzQWgikD7svSLs7J+XXzeA=";
    installPhase = ''
      runHook preInstall
      cp -r dist $out
      runHook postInstall
    '';
  };
in
stdenvNoCC.mkDerivation {
  pname = "bauble";
  version = "1.0.0";

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../pb_hooks
      ../pb_migrations
    ];
  };

  installPhase = ''
    runHook preInstall
    mkdir -p $out/share/bauble
    cp -r pb_hooks pb_migrations $out/share/bauble/
    cp -r ${web} $out/share/bauble/pb_public
    runHook postInstall
  '';

  passthru = { inherit web; };

  meta = {
    description = "Family wish list for Christmas and birthdays, served by PocketBase";
    homepage = "https://github.com/JirkaKlimes/bauble";
    license = lib.licenses.mit;
    platforms = lib.platforms.all;
  };
}
