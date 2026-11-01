/// <reference path="../.dev/pb_data/types.d.ts" />

// users    family members (invite only, no public sign-up)
// wishes   items on someone's list
// claims   "I'll buy this"; hidden from the wish owner until the occasion is over
// invites  one-time sign-up links, created by admins

migrate((app) => {
  const settings = app.settings();
  settings.meta.appName = "bauble";
  const url = $os.getenv("BAUBLE_URL");
  if (url) settings.meta.appURL = url;
  // cloudflared sets CF-Connecting-IP. Without a proxy that overwrites it,
  // clear this in the dashboard, or clients can spoof their IP for rate limits.
  settings.trustedProxy.headers = ["CF-Connecting-IP"];
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules.push({ label: "/api/bauble/preview", maxRequests: 20, duration: 60, audience: "" });
  settings.batch.enabled = false;
  app.save(settings);

  const users = app.findCollectionByNameOrId("users");
  users.listRule = '@request.auth.id != ""';
  users.viewRule = '@request.auth.id != ""';
  users.createRule = null; // accounts are only created through /api/bauble/join
  users.updateRule = 'id = @request.auth.id && @request.body.role:isset = false && @request.body.slot:isset = false';
  users.deleteRule = null;
  users.authToken.duration = 60 * 60 * 24 * 120;
  users.authAlert.enabled = false;
  users.otp.enabled = false;
  users.mfa.enabled = false;
  users.oauth2.enabled = false;
  users.passwordAuth.enabled = true;

  const name = users.fields.getByName("name");
  name.max = 40;
  name.required = true;
  const avatar = users.fields.getByName("avatar");
  avatar.protected = true;
  avatar.maxSize = 8 * 1024 * 1024;
  avatar.mimeTypes = ["image/jpeg", "image/png", "image/webp"];
  avatar.thumbs = ["512x512", "96x96"];
  // Czech name forms: vocative ("Ahoj, Karle"), instrumental ("s Karlem"), genitive ("od Karla")
  users.fields.add(new TextField({ name: "voc", max: 40 }));
  users.fields.add(new TextField({ name: "ins", max: 40 }));
  users.fields.add(new TextField({ name: "gen", max: 40 }));
  users.fields.add(new NumberField({ name: "bday_day", min: 1, max: 31, onlyInt: true }));
  users.fields.add(new NumberField({ name: "bday_month", min: 1, max: 12, onlyInt: true }));
  users.fields.add(new NumberField({ name: "slot", min: 0, max: 99, onlyInt: true }));
  users.fields.add(new SelectField({ name: "role", values: ["admin", "member"], maxSelect: 1 }));
  app.save(users);

  // The owner never sees a gone wish, so a delete looks the same whether or
  // not someone is buying it. Buyers keep seeing it, crossed out.
  const notOwnerUnlessLive = '@request.auth.id != "" && (gone = "" || owner != @request.auth.id)';
  const wishes = new Collection({
    type: "base",
    name: "wishes",
    listRule: notOwnerUnlessLive,
    viewRule: notOwnerUnlessLive,
    // server ids only: a client id could probe whether a gone wish still exists
    createRule: '@request.auth.id != "" && @request.body.owner = @request.auth.id && @request.body.id:isset = false && @request.body.gone:isset = false',
    updateRule: 'owner = @request.auth.id && gone = "" && @request.body.owner:isset = false',
    deleteRule: 'owner = @request.auth.id && gone = ""',
    fields: [
      { type: "relation", name: "owner", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "title", required: true, max: 120 },
      { type: "url", name: "url" },
      { type: "text", name: "store", max: 80 },
      { type: "number", name: "price", min: 0, onlyInt: true },
      { type: "text", name: "note", max: 200 },
      { type: "select", name: "pr", required: true, maxSelect: 1, values: ["top", "high", "nice"] },
      { type: "text", name: "art", max: 24 },
      { type: "url", name: "image_url" },
      { type: "file", name: "image", maxSelect: 1, maxSize: 5 * 1024 * 1024, thumbs: ["160x160"],
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] },
      { type: "select", name: "gone", maxSelect: 1, values: ["deleted", "got"] },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX idx_wishes_owner ON wishes (owner)"],
  });
  app.save(wishes);

  // Writes only go through /api/bauble/claims routes.
  const hiddenFromOwner = '@request.auth.id != "" && (wish.owner != @request.auth.id || reveal_at <= @now)';
  const claims = new Collection({
    type: "base",
    name: "claims",
    listRule: hiddenFromOwner,
    viewRule: hiddenFromOwner,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "relation", name: "wish", required: true, collectionId: wishes.id, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "by", required: true, collectionId: users.id, maxSelect: 99, cascadeDelete: false },
      { type: "text", name: "occ", required: true, max: 64, pattern: "^(xmas-[0-9]{4}|bday-[a-z0-9]+-[0-9]{4})$" },
      { type: "date", name: "reveal_at", required: true },
      { type: "bool", name: "revealed" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_claims_wish ON claims (wish)"],
  });
  app.save(claims);

  const admin = '@request.auth.role = "admin"';
  const invites = new Collection({
    type: "base",
    name: "invites",
    listRule: admin,
    viewRule: admin,
    createRule: admin + " && @request.body.token:isset = false && @request.body.used_by:isset = false && @request.body.used_at:isset = false",
    updateRule: null,
    deleteRule: admin + ' && used_by = ""',
    fields: [
      { type: "text", name: "token", required: true, min: 24, max: 24, pattern: "^[a-z0-9]+$", autogeneratePattern: "[a-z0-9]{24}" },
      { type: "text", name: "note", max: 40 },
      { type: "select", name: "role", required: true, maxSelect: 1, values: ["admin", "member"] },
      { type: "relation", name: "created_by", collectionId: users.id, maxSelect: 1 },
      { type: "relation", name: "used_by", collectionId: users.id, maxSelect: 1 },
      { type: "date", name: "used_at" },
      { type: "date", name: "expires" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_invites_token ON invites (token)"],
  });
  app.save(invites);
}, (app) => {
  for (const n of ["invites", "claims", "wishes"]) app.delete(app.findCollectionByNameOrId(n));
  const users = app.findCollectionByNameOrId("users");
  for (const f of ["voc", "ins", "gen", "bday_day", "bday_month", "slot", "role"]) users.fields.removeByName(f);
  users.createRule = "";
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  app.save(users);
});
