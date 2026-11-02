/// <reference path="../../.dev/pb_data/types.d.ts" />

const { Fail, handle, findOrNull, body, clean, nowUnix, pbDate, baseURL, isCurrency } = require(`${__hooks}/lib/core.js`);

const SLOTS = 12; // tree spots; keep in sync with the web client
const VALID_DAYS = 30;

function expiry() { return pbDate(new Date(Date.now() + VALID_DAYS * 86400000)); }

function find(db, token) {
  if (!/^[a-z0-9]{24}$/.test(String(token || ""))) return null;
  const inv = findOrNull(() => db.findFirstRecordByFilter("invites", "token = {:t}", { t: token }));
  if (!inv || inv.getString("used_by")) return null;
  const exp = inv.getDateTime("expires");
  if (!exp.isZero() && exp.unix() < nowUnix()) return null;
  return inv;
}

function check(e) {
  const inv = find($app, e.request.pathValue("token"));
  if (!inv) throw new Fail("invite_invalid");
  return e.json(200, { ok: true, note: inv.getString("note"), role: inv.getString("role") });
}

function defaults(e) {
  e.record.set("created_by", e.auth ? e.auth.id : "");
  if (!e.record.getString("role")) e.record.set("role", "member");
  if (e.record.getDateTime("expires").isZero()) e.record.set("expires", expiry());
}

function freeSlot(tx) {
  const used = {};
  for (const u of tx.findAllRecords("users")) used[u.getInt("slot")] = true;
  for (let i = 0; i < SLOTS; i++) if (!used[i]) return i;
  return tx.countRecords("users");
}

// Families mostly live in one country, so the inviter's currency is the best
// guess. A command-line invite has no inviter: then the browser's guess.
function currencyFor(tx, inv, guess) {
  const by = inv.getString("created_by");
  const inviter = by ? findOrNull(() => tx.findRecordById("users", by)) : null;
  if (inviter) return inviter.getString("currency");
  return isCurrency(guess) ? guess : "EUR";
}

function join(e) {
  const b = body(e);
  const name = clean(b.name, 40), email = clean(b.email, 200).toLowerCase(), password = String(b.password || "");
  if (!name) throw new Fail("name_required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Fail("email_invalid");
  if (password.length < 8) throw new Fail("password_short");
  const day = parseInt(b.bday_day, 10), month = parseInt(b.bday_month, 10);
  const hasBday = day >= 1 && day <= 31 && month >= 1 && month <= 12;

  let user = null;
  $app.runInTransaction((tx) => {
    // read through tx: SQLite serializes writers, so a second join with the
    // same token sees used_by set and fails
    const inv = find(tx, b.token);
    if (!inv) throw new Fail("invite_invalid");
    if (findOrNull(() => tx.findAuthRecordByEmail("users", email))) throw new Fail("email_taken");
    user = new Record(tx.findCollectionByNameOrId("users"));
    user.set("name", name);
    for (const k of ["voc", "ins", "gen"]) user.set(k, clean(b[k], 40) || name);
    user.set("email", email);
    user.set("emailVisibility", false);
    user.set("verified", true);
    user.setPassword(password);
    user.set("role", inv.getString("role") || "member");
    user.set("slot", freeSlot(tx));
    user.set("lang", b.lang === "cs" || b.lang === "en" ? b.lang : "");
    user.set("currency", currencyFor(tx, inv, b.currency));
    if (hasBday) { user.set("bday_day", day); user.set("bday_month", month); }
    tx.save(user);
    inv.set("used_by", user.id);
    inv.set("used_at", pbDate(new Date()));
    tx.save(inv);
  });
  return $apis.recordAuthResponse(e, user, "password", null);
}

function cli(args) {
  const role = args[0] === "admin" ? "admin" : "member";
  const note = (args[0] === "admin" || args[0] === "member" ? args.slice(1) : args).join(" ").slice(0, 40);
  const rec = new Record($app.findCollectionByNameOrId("invites"));
  rec.set("role", role);
  rec.set("note", note);
  rec.set("expires", expiry());
  $app.save(rec);
  console.log("");
  console.log("  Invite (" + role + (note ? ", " + note : "") + "), valid " + VALID_DAYS + " days, single use:");
  console.log("  " + baseURL() + "/i/" + rec.getString("token"));
  console.log("");
}

function cliBirthday(args) {
  const day = parseInt(args[1], 10), month = parseInt(args[2], 10);
  if (args.length !== 3 || !(day >= 1 && day <= 31 && month >= 1 && month <= 12)) throw new Error("usage: birthday <email> <day> <month>");
  const user = $app.findAuthRecordByEmail("users", String(args[0]).toLowerCase());
  user.set("bday_day", day);
  user.set("bday_month", month);
  $app.save(user);
  console.log("  " + user.getString("name") + ": birthday " + day + ". " + month + ".");
}

module.exports = { check: handle(check), defaults, join: handle(join), cli, cliBirthday };
