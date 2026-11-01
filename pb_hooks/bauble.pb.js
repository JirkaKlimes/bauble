/// <reference path="../.dev/pb_data/types.d.ts" />

routerUse((e) => require(`${__hooks}/lib/guard.js`).guard(e));

routerAdd("POST", "/api/bauble/claims", (e) => require(`${__hooks}/lib/claims.js`).create(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/claims/{id}/join", (e) => require(`${__hooks}/lib/claims.js`).join(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/claims/{id}/leave", (e) => require(`${__hooks}/lib/claims.js`).leave(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/claims/{id}/occ", (e) => require(`${__hooks}/lib/claims.js`).move(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/reveal", (e) => require(`${__hooks}/lib/claims.js`).reveal(e), $apis.requireAuth("users"));
routerAdd("GET", "/api/bauble/preview", (e) => require(`${__hooks}/lib/net.js`).preview(e), $apis.requireAuth("users"));

// public: the invite token is the credential
routerAdd("GET", "/api/bauble/invite/{token}", (e) => require(`${__hooks}/lib/invites.js`).check(e));
routerAdd("POST", "/api/bauble/join", (e) => require(`${__hooks}/lib/invites.js`).join(e));

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/invites.js`).defaults(e);
  e.next();
}, "invites");

onRecordDeleteRequest((e) => require(`${__hooks}/lib/wishes.js`).softDelete(e), "wishes");

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/wishes.js`).attachImage(e.record, "");
  e.next();
}, "wishes");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/wishes.js`).attachImage(e.record, e.record.original().getString("image_url"));
  e.next();
}, "wishes");

cronAdd("bauble_purge", "*/10 * * * *", () => require(`${__hooks}/lib/wishes.js`).purge());

$app.rootCmd.addCommand(new Command({
  use: "invite [admin|member] [note]",
  short: "Create a one-time family invite link",
  run: (_cmd, args) => require(`${__hooks}/lib/invites.js`).cli(args),
}));
