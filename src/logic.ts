import {
  Data,
  Food,
  Macros,
  Recipe,
  Session,
  SessionExercise,
  Profile,
  collections,
  dataSchema,
} from "./model";
export const zero = (): Macros => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});
export const macroKeys = ["calories", "protein", "carbs", "fat"] as const;
export const scale = (m: Macros, n: number): Macros =>
  Object.fromEntries(macroKeys.map((k) => [k, m[k] * n])) as Macros;
export const totals = (items: Macros[]): Macros =>
  items.reduce(
    (a, b) =>
      Object.fromEntries(macroKeys.map((k) => [k, a[k] + b[k]])) as Macros,
    zero(),
  );
export function foodMacros(food: Food, quantity: number, unit: string): Macros {
  if (!Number.isFinite(quantity) || quantity < 0)
    throw Error("Quantity must be a nonnegative number.");
  if (
    food.basis === "100g" &&
    (unit === "serving" || unit === "item") &&
    food.servingGrams <= 0
  )
    throw Error(
      "Set this food’s serving weight before logging servings or items. Grams and ounces are available.",
    );
  const grams =
    unit === "oz"
      ? quantity * 28.349523125
      : unit === "g"
        ? quantity
        : quantity * food.servingGrams;
  if (food.basis === "100g") return scale(food.macros, grams / 100);
  if (unit === "serving" || unit === "item")
    return scale(food.macros, quantity);
  if (food.servingGrams <= 0)
    throw Error(
      "Set this food’s serving weight before logging grams or ounces.",
    );
  return scale(food.macros, grams / food.servingGrams);
}
export function recipeMacros(
  r: Recipe,
  quantity: number,
  unit: "g" | "serving",
): Macros {
  if (quantity < 0 || !Number.isFinite(quantity))
    throw Error("Invalid portion");
  if (unit === "g" && r.finishedGrams <= 0)
    throw Error("Enter the finished recipe weight first.");
  return scale(
    totals(r.ingredients.map((i) => i.macros)),
    quantity / (unit === "g" ? r.finishedGrams : r.servings),
  );
}
export const newestFirst = (
  a: { date: string; createdAt?: number },
  b: { date: string; createdAt?: number },
) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0);
export const pace = (minutes: number, miles: number) =>
  miles > 0 && minutes > 0 ? minutes / miles : 0;
export function clock(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const sec = Math.round(minutes * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
export function localDate(
  tz = Intl.DateTimeFormat().resolvedOptions().timeZone,
  now = new Date(),
) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((t) => p.find((x) => x.type === t)!.value)
    .join("-");
}
export const addDays = (date: string, n: number) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekday = (d: string) =>
  (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;
export const monday = (d: string) => addDays(d, -weekday(d));
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
export const weekNumber = (start: string, date: string) =>
  Math.max(1, Math.min(4, Math.floor(daysBetween(start, date) / 7) + 1));
export function weekStats(sessions: Session[], date: string) {
  const start = monday(date),
    end = addDays(start, 7),
    s = sessions.filter(
      (s) => s.status === "complete" && s.date >= start && s.date < end,
    );
  return {
    sessions: s.length,
    days: new Set(s.map((s) => s.date)).size,
    sets: s.flatMap((s) =>
      s.exercises.flatMap((e) => e.sets.filter((x) => x.complete && !x.warmup)),
    ).length,
  };
}
export function recommendation(
  e: SessionExercise,
  week: number,
  p: Profile,
  poorRecovery = false,
): { weight: number | null; reason: string } {
  const s = e.sets.filter((s) => !s.warmup),
    done = s.filter((s) => s.complete),
    w = done.at(-1)?.weight ?? null;
  if (e.pain)
    return {
      weight: null,
      reason:
        "Pain reported. Do not add load or push through symptoms. Review the exercise and seek appropriate assessment.",
    };
  if (week === 4)
    return {
      weight: null,
      reason:
        "Deload week: follow the reduced programmed volume. No automatic load increase.",
    };
  if (
    e.skipped ||
    done.length < e.target.sets ||
    done.some((s) => s.reps === null || s.rpe === null) ||
    w === null
  )
    return {
      weight: null,
      reason:
        "Log every prescribed working set, repetitions and RPE before reviewing progression.",
    };
  const bounds = e.target.reps.match(/\d+/g)?.map(Number) ?? [0],
    min = bounds[0],
    max = bounds[1] ?? min,
    miss = done.reduce((a, s) => a + Math.max(0, min - (s.reps ?? 0)), 0),
    rpe = Math.max(...done.map((s) => s.rpe ?? 10)),
    increment = e.group === "lower" ? p.lowerIncrement : p.upperIncrement;
  if (miss >= 2 || poorRecovery || (rpe >= 9 && miss > 0))
    return {
      weight: Math.max(0, Math.floor((w * 0.95) / increment) * increment),
      reason:
        "Missed repetitions or poor recovery: consider a modest load reduction and reassess.",
    };
  if (rpe >= 9)
    return {
      weight: w,
      reason: "High effort at RPE 9–10: hold the load and prioritize recovery.",
    };
  if (e.group === "carry" || e.group === "core" || e.equipment === "Bodyweight")
    return {
      weight: w,
      reason:
        "Use the next programmed repetitions or distance; keep the current load.",
    };
  if (rpe <= 6 && e.form && done.every((s) => (s.reps ?? 0) >= max)) {
    const next = w + increment;
    if (e.equipment.toLowerCase().includes("dumbbell") && next > p.maxDumbbell)
      return {
        weight: w,
        reason:
          "At your available dumbbell limit. Hold load and improve controlled repetitions.",
      };
    return {
      weight: next,
      reason: `All target repetitions completed with excellent form at RPE ≤6. Consider +${increment} lb if this increment is available.`,
    };
  }
  return {
    weight: w,
    reason:
      "Hold the load. Build controlled repetitions toward the top of the prescribed range at RPE 7–8.",
  };
}
export function validateBackup(input: unknown): Data {
  const data = dataSchema.parse(input);
  for (const key of collections) {
    const ids = data[key].map((x) => x.id);
    if (new Set(ids).size !== ids.length)
      throw Error(`Duplicate IDs in ${key}.`);
  }
  for (const s of data.sessions) {
    const ids = s.exercises.flatMap((e) => e.sets.map((x) => x.id));
    if (new Set(ids).size !== ids.length) throw Error("Duplicate set IDs.");
  }
  return data;
}
export function mergeBackup(
  current: Data,
  incoming: Data,
): { data: Data; added: number; conflicts: number } {
  let added = 0,
    conflicts = 0;
  const data = { ...current };
  for (const key of collections) {
    const existing = new Set(current[key].map((x) => x.id));
    const fresh = incoming[key].filter((x) => !existing.has(x.id));
    added += fresh.length;
    conflicts += incoming[key].length - fresh.length;
    (data[key] as unknown[]) = [...current[key], ...fresh];
  }
  return { data, added, conflicts };
}
export const csv = (rows: (string | number | null)[][]) =>
  rows
    .map((r) =>
      r
        .map((c) => {
          let s = String(c ?? "");
          if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
export function coachReport(data: Data, from: string, to: string) {
  const within = (v: { date: string }) => v.date >= from && v.date <= to;
  const sessions = data.sessions.filter(
    (s) => s.status === "complete" && within(s),
  );
  const food = data.foodLogs.filter(within);
  const days = Math.max(1, daysBetween(from, to) + 1);
  const nutrition = totals(food.map((f) => f.macros));
  return [
    `HYBRID PERFORMANCE | ${from} through ${to}`,
    `Timezone: ${data.profile.timezone}. Units: lb, miles, minutes. Values below are recorded results, not projections.`,
    `Goals: ${data.profile.goals}`,
    `WORKOUTS (${sessions.length})`,
    ...sessions.map(
      (s) =>
        `${s.date} | ${s.name} | Week ${s.week} | ${Math.round(s.elapsed / 60)} min\n${s.exercises.map((e) => `${e.name}${e.name.toLowerCase().includes("pull-up") ? " (added load)" : ""}: ${e.skipped ? "SKIPPED" : e.sets.map((x, i) => `Set ${i + 1}${x.warmup ? " warm-up" : ""}: ${x.weight ?? "—"} lb × ${x.reps ?? "—"} ${e.unit}, RPE ${x.rpe ?? "—"}, ${x.complete ? "complete" : "incomplete"}`).join("; ")}. Pain: ${e.pain}. Notes: ${e.notes}`).join("\n")}\nSession notes: ${s.notes}`,
    ),
    "ENDURANCE",
    ...data.endurance
      .filter(within)
      .map(
        (e) =>
          `${e.date} ${e.kind}: ${e.distance} mi, ${clock(e.minutes)}, ${clock(pace(e.minutes, e.distance))}/mi, RPE ${e.rpe}, dry ${e.dryWeight} lb, total ${e.dryWeight + e.extraWeight} lb, elevation ${e.elevation} ft; ${e.terrain}; symptoms: ${e.symptoms}; ${e.notes}`,
      ),
    "NUTRITION",
    ...Array.from(new Set(food.map((f) => f.date)))
      .sort()
      .map((d) => {
        const t = totals(food.filter((f) => f.date === d).map((f) => f.macros));
        return `${d}: ${Math.round(t.calories)} kcal, P ${t.protein.toFixed(1)}g / C ${t.carbs.toFixed(1)}g / F ${t.fat.toFixed(1)}g`;
      }),
    `Period averages over ${days} calendar days (unlogged days count as zero): ${Math.round(nutrition.calories / days)} kcal, ${(nutrition.protein / days).toFixed(1)}g protein. Logged days: ${new Set(food.map((f) => f.date)).size}.`,
    "MEASUREMENTS / RECOVERY",
    ...data.measurements
      .filter(within)
      .map(
        (m) =>
          `${m.date}: weight ${m.weight ?? "—"} lb, waist ${m.waist ?? "—"} in, body fat ${m.bodyFat ?? "—"}%, pullups ${m.pullups ?? "—"}, sleep ${m.sleep ?? "—"}h, fatigue ${m.fatigue ?? "—"}/10, soreness ${m.soreness ?? "—"}/10; ${m.notes}`,
      ),
    `Ruck target (not achieved unless logged): ${data.profile.ruckMiles} mi × ${data.profile.ruckWeight} lb dry at ${clock(data.profile.ruckPace)}/mi.`,
    `Please evaluate these actual logs, note incomplete data, and suggest conservative changes with reasons. Do not assume unlogged performance.`,
  ].join("\n\n");
}
