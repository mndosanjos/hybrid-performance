import { describe, it, expect } from "vitest";
import { createSession } from "./Workouts";
import { seed } from "./seed";
describe("session snapshots", () => {
  it("keeps sessions independent from program edits", () => {
    const p = seed().programs[0];
    const s = createSession(p, p.days[0], 1, "2026-11-05", []);
    p.days[0].exercises[0].weeks[0].sets = 12;
    p.days[0].exercises[0].name = "Changed";
    expect(s.exercises[0].target.sets).toBe(3);
    expect(s.exercises[0].name).toBe("Barbell back squat");
    expect(
      s.exercises[0].sets.every((x) => !x.complete && x.weight === null),
    ).toBe(true);
  });
  it("uses accepted suggestions from the most recent same-day session", () => {
    const p = seed().programs[0],
      a = createSession(p, p.days[0], 1, "2026-11-05", []),
      b = createSession(p, p.days[0], 1, "2026-11-05", []);
    a.status = b.status = "complete";
    a.createdAt = 1;
    b.createdAt = 2;
    a.exercises[0].decision = b.exercises[0].decision = "accepted";
    a.exercises[0].suggestedWeight = 100;
    b.exercises[0].suggestedWeight = 105;
    const next = createSession(p, p.days[0], 2, "2026-11-06", [a, b]);
    expect(next.exercises[0].sets[0].weight).toBe(105);
    expect(next.id).not.toBe(a.id);
  });
  it("never prefills an accepted increase in the deload week", () => {
    const p = seed().programs[0],
      a = createSession(p, p.days[0], 3, "2026-11-05", []);
    a.status = "complete";
    a.exercises[0].decision = "accepted";
    a.exercises[0].suggestedWeight = 105;
    expect(
      createSession(p, p.days[0], 4, "2026-11-06", [a]).exercises[0].sets[0]
        .weight,
    ).toBeNull();
  });
});
