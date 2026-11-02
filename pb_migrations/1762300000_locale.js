/// <reference path="../.dev/pb_data/types.d.ts" />

// Language, currency and the Christmas gift day.
// Before this, every price was in CZK and presents came on 24 December,
// so existing data keeps exactly that meaning.

const FAMILY = "family000000000";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  // empty: the person has not chosen, so the device language applies
  users.fields.add(new SelectField({ name: "lang", values: ["cs", "en"], maxSelect: 1 }));
  // the currency the person reads prices in
  users.fields.add(new TextField({ name: "currency", required: true, pattern: "^[A-Z]{3}$" }));
  app.save(users);
  app.db().newQuery("UPDATE users SET currency = 'CZK'").execute();

  // a price stays in the currency the shop or the owner gave it in
  const wishes = app.findCollectionByNameOrId("wishes");
  wishes.fields.getByName("price").onlyInt = false;
  wishes.fields.add(new TextField({ name: "currency", pattern: "^[A-Z]{3}$" }));
  app.save(wishes);
  app.db().newQuery("UPDATE wishes SET currency = 'CZK' WHERE price > 0").execute();

  // One record. Anyone may read it, the login screen needs the gift day too.
  // Admins change it through /api/bauble/family, which keeps claims in step.
  const family = new Collection({
    type: "base",
    name: "family",
    listRule: null,
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [{ type: "select", name: "christmas", required: true, maxSelect: 1, values: ["eve", "day"] }],
  });
  app.save(family);
  const rec = new Record(family);
  rec.set("id", FAMILY);
  rec.set("christmas", "eve");
  app.save(rec);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("family"));
  const wishes = app.findCollectionByNameOrId("wishes");
  app.db().newQuery("UPDATE wishes SET price = ROUND(price)").execute();
  wishes.fields.removeByName("currency");
  wishes.fields.getByName("price").onlyInt = true;
  app.save(wishes);
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("lang");
  users.fields.removeByName("currency");
  app.save(users);
});
