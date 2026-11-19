import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { db, loadData, persist } from "./storage";
import Dexie from "dexie";
import { seed } from "./seed";
import { collections } from "./model";
describe("IndexedDB durability", () => {
  it("migrates version 2 foods without dropping old records", async () => {
    const legacy = new Dexie("hybrid-performance");
    legacy
      .version(2)
      .stores({
        meta: "id",
        programs: "id,start",
        sessions: "id,date,status",
        foods: "id,name",
        foodLogs: "id,date,foodId",
        recipes: "id,name",
        endurance: "id,date,kind",
        measurements: "id,date",
      });
    const original = seed();
    await legacy.open();
    await legacy.table("meta").put({ id: "profile", value: original.profile });
    for (const key of collections)
      await legacy.table(key).bulkPut(original[key]);
    legacy.close();
    const migrated = await loadData();
    expect(migrated.foods).toHaveLength(16);
    expect(migrated.programs[0].id).toBe(original.programs[0].id);
    await db
      .table("foods")
      .put({ ...migrated.foods[0], barcode: "3017620422003" });
    expect(
      await db.table("foods").where("barcode").equals("3017620422003").count(),
    ).toBe(1);
  });
  afterEach(async () => {
    await db.delete();
  });
  it("initializes once and restores edited data after closing database", async () => {
    const initial = await loadData();
    const next = {
      ...initial,
      profile: { ...initial.profile, name: "Saved athlete" },
    };
    await persist(next, initial);
    db.close();
    const restored = await loadData();
    expect(restored.profile.name).toBe("Saved athlete");
    expect(restored.foods.length).toBe(initial.foods.length);
  });
  it("atomically adds and removes records without changing unrelated stores", async () => {
    const a = await loadData();
    const b = { ...a, foods: a.foods.slice(1) };
    await persist(b, a);
    expect((await loadData()).foods).toHaveLength(a.foods.length - 1);
    expect((await loadData()).programs).toEqual(a.programs);
  });
  it("does not reseed or erase malformed existing data", async () => {
    await loadData();
    await db.table("meta").put({ id: "profile", value: { name: "malformed" } });
    await expect(loadData()).rejects.toThrow();
    expect(await db.table("foods").count()).toBe(16);
  });
  it("initializes only once when two tabs open together", async () => {
    const [a, b] = await Promise.all([loadData(), loadData()]);
    expect(a.programs[0].id).toBe(b.programs[0].id);
    expect(await db.table("foods").count()).toBe(16);
    expect(await db.table("programs").count()).toBe(1);
  });
  it("does not invent a new profile over existing history", async () => {
    const original = await loadData();
    await db.table("meta").delete("profile");
    await expect(loadData()).rejects.toThrow("profile is missing");
    expect((await db.table("programs").toArray())[0].id).toBe(
      original.programs[0].id,
    );
    expect(await db.table("meta").get("profile")).toBeUndefined();
  });
});
