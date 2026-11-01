/// <reference path="../../.dev/pb_data/types.d.ts" />

const { Fail, handle, findOrNull, body, strSlice, nowUnix, pbDate, revealAt, nextOccasions } = require(`${__hooks}/lib/core.js`);

function toJSON(c) {
  return { id: c.id, wish: c.getString("wish"), by: strSlice(c, "by"), occ: c.getString("occ"), reveal_at: c.getString("reveal_at"), revealed: c.getBool("revealed") };
}

function isOver(c) {
  const r = c.getDateTime("reveal_at");
  return !r.isZero() && r.unix() <= nowUnix();
}

function findByWish(wishId) {
  return findOrNull(() => $app.findFirstRecordByFilter("claims", "wish = {:w}", { w: wishId }));
}

// Loads a claim the caller may act on. The wish owner gets the same answer as
// for a missing claim, so claim ids never confirm anything to them.
function loadForBuyer(e) {
  const c = findOrNull(() => $app.findRecordById("claims", e.request.pathValue("id")));
  if (!c) throw new Fail("claim_not_found");
  const wish = $app.findRecordById("wishes", c.getString("wish"));
  if (wish.getString("owner") === e.auth.id) throw new Fail("claim_not_found");
  return { c, wish };
}

function pickOccasion(wish, occId) {
  const owner = $app.findRecordById("users", wish.getString("owner"));
  const occs = nextOccasions(owner);
  if (!occId) return occs[0];
  const occ = occs.find((o) => o.id === occId);
  if (!occ) throw new Fail("occ_invalid");
  return occ;
}

function create(e) {
  const b = body(e), me = e.auth;
  const wish = findOrNull(() => $app.findRecordById("wishes", String(b.wish || "")));
  if (!wish) throw new Fail("wish_not_found");
  if (wish.getString("owner") === me.id) throw new Fail("own_wish");
  if (wish.getString("gone")) throw new Fail("wish_gone");
  const occ = pickOccasion(wish, b.occ);

  const taken = () => { const c = findByWish(wish.id); return c ? new Fail("claim_taken", { claim: toJSON(c) }) : null; };
  const early = taken();
  if (early) throw early;

  const rec = new Record($app.findCollectionByNameOrId("claims"));
  // the client may pick the id, so its optimistic copy and the realtime event line up
  if (/^[a-z0-9]{15}$/.test(String(b.id || ""))) rec.set("id", b.id);
  rec.set("wish", wish.id);
  rec.set("by", [me.id]);
  rec.set("occ", occ.id);
  rec.set("reveal_at", pbDate(revealAt(occ.day)));
  rec.set("revealed", false);
  try {
    $app.save(rec);
  } catch (err) {
    throw taken() || err;
  }
  return e.json(200, toJSON(rec));
}

function join(e) {
  const { c } = loadForBuyer(e);
  if (isOver(c)) throw new Fail("occasion_over");
  const by = strSlice(c, "by");
  if (by.indexOf(e.auth.id) < 0) { by.push(e.auth.id); c.set("by", by); $app.save(c); }
  return e.json(200, toJSON(c));
}

function leave(e) {
  const { c } = loadForBuyer(e);
  if (isOver(c)) throw new Fail("occasion_over");
  const before = strSlice(c, "by");
  if (before.indexOf(e.auth.id) < 0) throw new Fail("not_buyer");
  const by = before.filter((id) => id !== e.auth.id);
  let deleted = false, wishDeleted = false;
  $app.runInTransaction((tx) => {
    if (by.length) { c.set("by", by); tx.save(c); return; }
    const wish = tx.findRecordById("wishes", c.getString("wish"));
    tx.delete(c); deleted = true;
    if (wish.getString("gone")) { tx.delete(wish); wishDeleted = true; }
  });
  return e.json(200, { claim: deleted ? null : toJSON(c), deleted, wishDeleted });
}

function move(e) {
  const { c, wish } = loadForBuyer(e);
  if (strSlice(c, "by").indexOf(e.auth.id) < 0) throw new Fail("not_buyer");
  if (isOver(c)) throw new Fail("occasion_over");
  const occ = pickOccasion(wish, String(body(e).occ || "") || "-");
  c.set("occ", occ.id);
  c.set("reveal_at", pbDate(revealAt(occ.day)));
  $app.save(c);
  return e.json(200, toJSON(c));
}

function reveal(e) {
  const list = $app.findRecordsByFilter("claims", "wish.owner = {:me} && reveal_at <= @now && revealed = false", "", 0, 0, { me: e.auth.id });
  for (const c of list) { c.set("revealed", true); $app.save(c); }
  return e.json(200, { revealed: list.length });
}

module.exports = { create: handle(create), join: handle(join), leave: handle(leave), move: handle(move), reveal };
