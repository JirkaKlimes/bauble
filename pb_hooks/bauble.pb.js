/// <reference path="../.dev/pb_data/types.d.ts" />

routerUse((e) => require(`${__hooks}/lib/guard.js`).guard(e));

routerAdd("POST", "/api/bauble/claims", (e) => require(`${__hooks}/lib/claims.js`).create(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/claims/{id}/join", (e) => require(`${__hooks}/lib/claims.js`).join(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/claims/{id}/leave", (e) => require(`${__hooks}/lib/claims.js`).leave(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/claims/{id}/occ", (e) => require(`${__hooks}/lib/claims.js`).move(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/reveal", (e) => require(`${__hooks}/lib/claims.js`).reveal(e), $apis.requireAuth("users"));
routerAdd("GET", "/api/bauble/preview", (e) => require(`${__hooks}/lib/net.js`).preview(e), $apis.requireAuth("users"));
routerAdd("POST", "/api/bauble/family", (e) => require(`${__hooks}/lib/family.js`).setChristmas(e), $apis.requireAuth("users"));

// public: reference rates, cached on the server; sign-up uses them to guess a currency
routerAdd("GET", "/api/bauble/rates", (e) => require(`${__hooks}/lib/rates.js`).rates(e));

// public: the invite token is the credential
routerAdd("GET", "/api/bauble/invite/{token}", (e) => require(`${__hooks}/lib/invites.js`).check(e));
routerAdd("POST", "/api/bauble/join", (e) => require(`${__hooks}/lib/invites.js`).join(e));

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/invites.js`).defaults(e);
  e.next();
}, "invites");

onRecordDeleteRequest((e) => require(`${__hooks}/lib/wishes.js`).softDelete(e), "wishes");

onRecordValidate((e) => {
  require(`${__hooks}/lib/wishes.js`).checkPrice(e.record);
  e.next();
}, "wishes");

onRecordCreateRequest((e) => {
  require(`${__hooks}/lib/wishes.js`).attachImage(e.record, "");
  return require(`${__hooks}/lib/images.js`).guardUpload(e, "image");
}, "wishes");

onRecordUpdateRequest((e) => {
  require(`${__hooks}/lib/wishes.js`).attachImage(e.record, e.record.original().getString("image_url"));
  return require(`${__hooks}/lib/images.js`).guardUpload(e, "image");
}, "wishes");

onRecordUpdateRequest((e) => require(`${__hooks}/lib/images.js`).guardUpload(e, "avatar"), "users");

cronAdd("bauble_purge", "*/10 * * * *", () => require(`${__hooks}/lib/wishes.js`).purge());

// Members set their birthday once; moving it would move the reveal of their gifts.
$app.rootCmd.addCommand(new Command({
  use: "birthday <email> <day> <month>",
  short: "Change a member's birthday",
  run: (_cmd, args) => require(`${__hooks}/lib/invites.js`).cliBirthday(args),
}));

$app.rootCmd.addCommand(new Command({
  use: "invite [admin|member] [note]",
  short: "Create a one-time family invite link",
  run: (_cmd, args) => require(`${__hooks}/lib/invites.js`).cli(args),
}));
