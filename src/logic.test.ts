import { describe, it, expect } from "vitest";
import { seed } from "./seed";
import {
  addDays,
  clock,
  coachReport,
  csv,
  foodMacros,
  localDate,
  mergeBackup,
  monday,
  pace,
  recommendation,
  recipeMacros,
  totals,
  validateBackup,
  weekStats,
  zero,
} from "./logic";
import { SessionExercise, Session, uid } from "./model";
const exercise = (): SessionExercise => ({
  id: uid(),
  sourceId: "bench",
  name: "Bench press",
  group: "upper",
  equipment: "Barbell",
  unit: "reps",
  target: { sets: 3, reps: "5–6", rpe: 7, rest: 180 },
  technique: "",
  notes: "",
  pain: false,
  form: true,
  skipped: false,
  decision: "pending",
  suggestedWeight: null,
  sets: Array.from({ length: 3 }, () => ({
    id: uid(),
    weight: 100,
    reps: 6,
    rpe: 6,
    complete: true,
    warmup: false,
  })),
});
const session = (date: string): Session => ({
  id: uid(),
  date,
  programId: "p",
  dayId: "d",
  name: "Test",
  week: 1,
  status: "complete",
  elapsed: 60,
  runningSince: null,
  notes: "",
  exercises: [exercise()],
});
describe("nutrition calculations", () => {
  it("scales 199 g chicken correctly", () => {
    expect(foodMacros(seed().foods[0], 199, "g").calories).toBeCloseTo(328.35);
    expect(foodMacros(seed().foods[0], 199, "g").protein).toBeCloseTo(61.69);
  });
  it("converts ounces to grams precisely", () => {
    expect(foodMacros(seed().foods[0], 1, "oz").calories).toBeCloseTo(
      46.77671315625,
    );
  });
  it("scales item weights", () => {
    expect(foodMacros(seed().foods[3], 2, "item").calories).toBe(143);
  });
  it("supports label-based per serving foods", () => {
    const f = {
      ...seed().foods[0],
      basis: "serving" as const,
      servingGrams: 50,
    };
    expect(foodMacros(f, 100, "g").calories).toBe(330);
    expect(foodMacros(f, 2, "serving").calories).toBe(330);
  });
  it("rejects unknown serving weight for grams", () => {
    const f = {
      ...seed().foods[0],
      basis: "serving" as const,
      servingGrams: 0,
    };
    expect(() => foodMacros(f, 20, "g")).toThrow();
    expect(foodMacros(f, 2, "serving").calories).toBe(330);
  });
  it("rejects negative and non-finite quantities", () => {
    expect(() => foodMacros(seed().foods[0], -1, "g")).toThrow();
    expect(() => foodMacros(seed().foods[0], NaN, "g")).toThrow();
  });
  it("adds all macro fields without rounding intermediate totals", () => {
    expect(
      totals([
        { calories: 10, protein: 1.5, carbs: 2, fat: 3 },
        { calories: 20, protein: 2.2, carbs: 5, fat: 1 },
      ]),
    ).toEqual({ calories: 30, protein: 3.7, carbs: 7, fat: 4 });
    expect(totals([])).toEqual(zero());
  });
  it("portions recipes by servings or finished grams", () => {
    const r = {
      id: "r",
      name: "Meal",
      servings: 4,
      finishedGrams: 800,
      template: false,
      ingredients: [
        {
          id: "a",
          name: "A",
          grams: 200,
          macros: { calories: 400, protein: 40, carbs: 10, fat: 20 },
        },
        {
          id: "b",
          name: "B",
          grams: 400,
          macros: { calories: 600, protein: 20, carbs: 100, fat: 5 },
        },
      ],
    };
    expect(recipeMacros(r, 1, "serving").calories).toBe(250);
    expect(recipeMacros(r, 300, "g").calories).toBe(375);
    expect(() => recipeMacros({ ...r, finishedGrams: 0 }, 10, "g")).toThrow();
  });
});
describe("dates and endurance", () => {
  it("calculates run and ruck pace", () => {
    expect(pace(20, 3)).toBeCloseTo(6.6666667);
    expect(clock(pace(20, 3))).toBe("6:40");
    expect(clock(pace(72, 6))).toBe("12:00");
    expect(pace(30, 0)).toBe(0);
  });
  it("rounds seconds with carry", () => expect(clock(6.999)).toBe("7:00"));
  it("uses selected timezone around midnight", () => {
    const now = new Date("2026-11-05T02:00:00Z");
    expect(localDate("America/New_York", now)).toBe("2026-11-04");
    expect(localDate("Asia/Tokyo", now)).toBe("2026-11-05");
  });
  it("handles DST and calendar boundaries without shifting dates", () => {
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(monday("2026-11-08")).toBe("2026-11-02");
  });
  it("counts multiple sessions on one day but not unfinished or outside week", () => {
    const a = session("2026-11-05"),
      b = session("2026-11-05");
    const stats = weekStats(
      [
        a,
        b,
        { ...session("2026-11-06"), status: "active" },
        session("2026-11-09"),
      ],
      "2026-11-05",
    );
    expect(stats).toEqual({ sessions: 2, days: 1, sets: 6 });
  });
});
describe("transparent progression", () => {
  it("suggests practical upper / lower increments after easy excellent sets", () => {
    const e = exercise(),
      p = seed().profile;
    expect(recommendation(e, 1, p).weight).toBe(102.5);
    expect(recommendation({ ...e, group: "lower" }, 1, p).weight).toBe(105);
  });
  it("never increases on pain or deload", () => {
    const e = exercise(),
      p = seed().profile;
    expect(recommendation({ ...e, pain: true }, 1, p).weight).toBeNull();
    expect(recommendation(e, 4, p).weight).toBeNull();
  });
  it("does not reward unfinished sets or absent RPE", () => {
    const e = exercise();
    e.sets[0].complete = false;
    expect(recommendation(e, 1, seed().profile).weight).toBeNull();
    e.sets[0].complete = true;
    e.sets[0].rpe = null;
    expect(recommendation(e, 1, seed().profile).weight).toBeNull();
  });
  it("holds moderate effort and high effort without missed reps", () => {
    const e = exercise();
    e.sets.forEach((s) => (s.rpe = 8));
    expect(recommendation(e, 1, seed().profile).weight).toBe(100);
    e.sets.forEach((s) => (s.rpe = 9));
    expect(recommendation(e, 1, seed().profile).weight).toBe(100);
  });
  it("reduces load after missed reps or poor recovery", () => {
    const e = exercise();
    e.sets[0].reps = 2;
    expect(recommendation(e, 1, seed().profile).weight).toBe(95);
    expect(recommendation(exercise(), 1, seed().profile, true).weight).toBe(95);
  });
  it("respects dumbbell ceiling and excludes warmups", () => {
    const e = exercise();
    e.equipment = "Dumbbells";
    e.sets.forEach((s) => (s.weight = 70));
    e.sets.push({ ...e.sets[0], id: uid(), weight: 20, rpe: 10, warmup: true });
    expect(recommendation(e, 1, seed().profile).weight).toBe(70);
  });
});
describe("backup and exports", () => {
  it("round trips the complete seeded program", () => {
    const d = seed();
    expect(validateBackup(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(d.programs[0].days).toHaveLength(7);
    expect(d.programs[0].days[0].exercises[0].weeks.map((w) => w.sets)).toEqual(
      [3, 3, 4, 2],
    );
  });
  it("rejects bad version, negative macros and impossible calendar dates", () => {
    const d = seed();
    expect(() => validateBackup({ ...d, version: 2 })).toThrow();
    d.foods[0].macros.calories = -1;
    expect(() => validateBackup(d)).toThrow();
    const v = seed();
    v.sessions = [session("2026-02-30")];
    expect(() => validateBackup(v)).toThrow();
  });
  it("rejects malformed nested sets and duplicate IDs", () => {
    const d = seed();
    d.sessions = [session("2026-11-05")];
    d.sessions[0].exercises[0].sets[0].rpe = 11;
    expect(() => validateBackup(d)).toThrow();
    const v = seed();
    v.foods.push(v.foods[0]);
    expect(() => validateBackup(v)).toThrow();
  });
  it("merges without silently overwriting existing records or profile", () => {
    const current = seed(),
      incoming = structuredClone(current);
    incoming.profile.name = "Other";
    incoming.foods[0].name = "Changed";
    incoming.sessions.push(session("2026-11-05"));
    const merged = mergeBackup(current, incoming);
    expect(merged.added).toBe(1);
    expect(merged.data.foods[0].name).toBe(current.foods[0].name);
    expect(merged.data.profile.name).toBe(current.profile.name);
    expect(mergeBackup(merged.data, incoming).added).toBe(0);
  });
  it("escapes CSV cells and formula injection", () => {
    expect(csv([["a,b", '"hello"', "=1+1"]])).toBe(
      '"a,b","""hello""","\'=1+1"',
    );
  });
  it("includes only completed sessions in coaching date range", () => {
    const d = seed();
    d.sessions = [
      session("2026-11-05"),
      { ...session("2026-11-04"), status: "active" },
      session("2026-10-01"),
    ];
    const text = coachReport(d, "2026-11-01", "2026-11-05");
    expect(text).toContain("WORKOUTS (1)");
    expect(text).toContain("100 lb × 6 reps, RPE 6");
    expect(text).not.toContain("2026-10-01 |");
  });
});
