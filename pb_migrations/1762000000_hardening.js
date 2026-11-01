/// <reference path="../.dev/pb_data/types.d.ts" />

migrate((app) => {
  // The superuser API only answers on loopback (an SSH tunnel or bauble-ctl).
  // Through cloudflared the client IP comes from CF-Connecting-IP, so it never matches.
  const settings = app.settings();
  settings.superuserIPs = ["127.0.0.1", "::1"];
  app.save(settings);

  // A birthday can be set once. Moving it to today would reveal tonight who
  // buys what; admins change it with `bauble-ctl birthday`.
  const users = app.findCollectionByNameOrId("users");
  users.updateRule = 'id = @request.auth.id && @request.body.role:isset = false && @request.body.slot:isset = false' +
    ' && (bday_month = 0 || (@request.body.bday_day:isset = false && @request.body.bday_month:isset = false))';
  // protected avatars and product images need a file token; a day keeps long sessions working
  users.fileToken.duration = 60 * 60 * 24;
  app.save(users);

  // Unprotected files stay readable after the record is hidden, which told
  // the owner of a deleted wish whether someone was still buying it.
  const wishes = app.findCollectionByNameOrId("wishes");
  const image = wishes.fields.getByName("image");
  image.protected = true;
  image.mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  app.save(wishes);
}, (app) => {
  const settings = app.settings();
  settings.superuserIPs = [];
  app.save(settings);
  const users = app.findCollectionByNameOrId("users");
  users.updateRule = 'id = @request.auth.id && @request.body.role:isset = false && @request.body.slot:isset = false';
  users.fileToken.duration = 180;
  app.save(users);
  const wishes = app.findCollectionByNameOrId("wishes");
  const image = wishes.fields.getByName("image");
  image.protected = false;
  image.mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
  app.save(wishes);
});
