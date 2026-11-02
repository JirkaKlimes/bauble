/// <reference path="../../.dev/pb_data/types.d.ts" />

const { Fail, handle, body, pbDate, revealAt, FAMILY, isChristmas, xmasDay, inChristmasSeason } = require(`${__hooks}/lib/core.js`);

// The gift day decides when Christmas claims are revealed. A change during the
// season could reveal them before the presents are opened, so it waits until
// the season is over. Pending claims move with the day.
function setChristmas(e) {
  if (e.auth.getString("role") !== "admin") throw new Fail("admin_only");
  const which = body(e).christmas;
  if (!isChristmas(which)) throw new Fail("christmas_invalid");
  if (inChristmasSeason(new Date())) throw new Fail("christmas_locked");
  $app.runInTransaction((tx) => {
    const fam = tx.findRecordById("family", FAMILY);
    fam.set("christmas", which);
    tx.save(fam);
    for (const c of tx.findRecordsByFilter("claims", "occ ~ 'xmas-' && reveal_at > @now", "", 0, 0)) {
      c.set("reveal_at", pbDate(revealAt(xmasDay(parseInt(c.getString("occ").slice(5), 10), which))));
      tx.save(c);
    }
  });
  return e.json(200, { christmas: which });
}

module.exports = { setChristmas: handle(setChristmas) };
