{
  lib,
  runCommand,
  pocketbase,
  python3,
  curl,
  tzdata,
}:

let
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../pb_hooks
      ../pb_migrations
      ../tests
    ];
  };
in
runCommand "bauble-api-test"
  {
    nativeBuildInputs = [
      pocketbase
      python3
      curl
    ];
    ZONEINFO = "${tzdata}/share/zoneinfo";
  }
  ''
    cp -r ${src}/. src && chmod -R u+w src && cd src
    HOME=$TMPDIR bash tests/run_api_tests.sh
    touch $out
  ''
