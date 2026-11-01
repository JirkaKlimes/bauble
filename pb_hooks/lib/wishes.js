/// <reference path="../../.dev/pb_data/types.d.ts" />

const { fetchURL, allowedURL } = require(`${__hooks}/lib/net.js`);
const { acceptable } = require(`${__hooks}/lib/images.js`);

// Every owner delete is a soft delete, with or without buyers. A hard delete
// only for unclaimed wishes would let the owner tell the two apart (404 vs 200
// on a later request, realtime events, id reuse). The purge job removes the
// unclaimed ones later; the owner can never see a gone wish either way.
function softDelete(e) {
  e.record.set("gone", "deleted");
  $app.save(e.record);
  return e.noContent(204);
}

function purge() {
  const gone = $app.findRecordsByFilter("wishes", 'gone != ""', "", 0, 0);
  for (const w of gone) {
    const active = $app.findRecordsByFilter("claims", "wish = {:w} && reveal_at > @now", "", 1, 0, { w: w.id });
    if (!active.length) $app.delete(w);
  }
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Download the product image once, so the list never hotlinks shops.
function attachImage(record, previous) {
  const u = record.getString("image_url");
  if (!u || u === previous || !allowedURL(u)) return;
  try {
    const res = fetchURL(u, "image/avif,image/webp,image/*", 12);
    const type = String((res.headers["Content-Type"] || [""])[0]).split(";")[0].trim().toLowerCase();
    if (res.statusCode >= 400 || IMAGE_TYPES.indexOf(type) < 0 || res.body.length > 5 * 1024 * 1024 || res.body.length < 200 || !acceptable(res.body)) return;
    record.set("image", $filesystem.fileFromBytes(res.body, "product." + type.split("/")[1].replace("jpeg", "jpg")));
  } catch (err) {
    console.log("bauble: image download failed:", String(err));
  }
}

module.exports = { softDelete, purge, attachImage };
