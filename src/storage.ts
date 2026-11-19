import Dexie from "dexie";
import { Data, collections } from "./model";
import { validateBackup } from "./logic";
import { seed } from "./seed";
export const db = new Dexie("hybrid-performance");
// Version 1 creates normalized record stores. Version 2 adds searchable date indexes.
db.version(1).stores({
  meta: "id",
  programs: "id",
  sessions: "id",
  foods: "id",
  foodLogs: "id",
  recipes: "id",
  endurance: "id",
  measurements: "id",
});
db.version(2).stores({
  meta: "id",
  programs: "id,start",
  sessions: "id,date,status",
  foods: "id,name",
  foodLogs: "id,date,foodId",
  recipes: "id,name",
  endurance: "id,date,kind",
  measurements: "id,date",
});
// Additive index migration: old foods and all historical snapshots are retained.
db.version(3).stores({ foods: "id,name,barcode" });
export async function loadData(): Promise<Data> {
  await db.open();
  // Serialize initialization across browser tabs, and read a consistent snapshot.
  return db.transaction("rw", db.tables, async () => {
    const meta = await db.table("meta").get("profile");
    if (!meta) {
      for (const key of collections) {
        if (await db.table(key).count()) {
          throw new Error(
            "The profile is missing but history exists. Restore a backup in a separate browser; existing records were preserved.",
          );
        }
      }
      const initial = seed();
      await db.table("meta").put({ id: "profile", value: initial.profile });
      for (const key of collections) await db.table(key).bulkPut(initial[key]);
      return initial;
    }
    const data = { version: 1, profile: meta.value } as Data;
    for (const k of collections)
      (data[k] as unknown[]) = await db.table(k).toArray();
    return validateBackup(data);
  });
}
export async function persist(next: Data, prev?: Data) {
  await db.transaction("rw", db.tables, async () => {
    if (!prev || prev.profile !== next.profile)
      await db.table("meta").put({ id: "profile", value: next.profile });
    for (const k of collections) {
      if (prev?.[k] === next[k]) continue;
      const before = new Map(prev?.[k].map((x) => [x.id, x]));
      const after = new Set(next[k].map((x) => x.id));
      const removed = [...before.keys()].filter((id) => !after.has(id));
      if (removed.length) await db.table(k).bulkDelete(removed);
      const changed = next[k].filter((x) => before.get(x.id) !== x);
      if (changed.length) await db.table(k).bulkPut(changed);
    }
  });
}
