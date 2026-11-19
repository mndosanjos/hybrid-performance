import { useEffect, useState } from "react";
import {
  Play,
  Pause,
  Check,
  Plus,
  Trash2,
  ChevronUp,
  Timer,
  ArrowLeft,
  Copy,
  Flag,
} from "lucide-react";
import { useStore } from "./store";
import {
  Button,
  Card,
  Field,
  NumberInput,
  Modal,
  Empty,
  confirmDelete,
} from "./components";
import { Day, Program, Session, SessionExercise, WorkSet, uid } from "./model";
import {
  clock,
  localDate,
  newestFirst,
  recommendation,
  weekNumber,
  weekday,
} from "./logic";
export function createSession(
  p: Program,
  day: Day,
  week: number,
  date: string,
  history: Session[],
): Session {
  return {
    id: uid(),
    date,
    createdAt: Date.now(),
    programId: p.id,
    dayId: day.id,
    name: day.name,
    kind: day.kind,
    instructions: [day.notes, day.endurance[week - 1]]
      .filter(Boolean)
      .join(" · "),
    week,
    status: "active",
    elapsed: 0,
    runningSince: Date.now(),
    notes: "",
    exercises: day.exercises.map((e) => {
      const prev = history
        .filter((s) => s.status === "complete" && s.date <= date)
        .sort(newestFirst)
        .flatMap((s) => s.exercises)
        .find((x) => x.sourceId === e.id);
      const weight =
        week !== 4 && prev?.decision === "accepted"
          ? prev.suggestedWeight
          : null;
      return {
        id: uid(),
        sourceId: e.id,
        name: e.name,
        group: e.group,
        equipment: e.equipment,
        unit: e.unit,
        target: { ...e.weeks[week - 1] },
        technique: e.notes,
        notes: "",
        pain: false,
        form: false,
        skipped: false,
        decision: "pending",
        suggestedWeight: null,
        sets: Array.from({ length: e.weeks[week - 1].sets }, () => ({
          id: uid(),
          weight,
          reps: null,
          rpe: null,
          complete: false,
          warmup: false,
        })),
      };
    }),
  };
}
export default function Workouts({
  sessionId,
  setSessionId,
  onEndurance,
  onRecovery,
  onEditPlan,
  initialDate,
}: {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  onEndurance: (kind: "run" | "ruck" | "row", date?: string) => void;
  onRecovery: (date?: string) => void;
  onEditPlan: () => void;
  initialDate?: string;
}) {
  const { data, update } = useStore(),
    today = localDate(data.profile.timezone);
  const [programId, setProgramId] = useState(
      data.programs.find((p) => !p.archived)?.id ?? data.programs[0]?.id,
    ),
    [week, setWeek] = useState(
      weekNumber(
        data.programs.find((p) => p.id === programId)?.start ?? today,
        initialDate ?? today,
      ),
    ),
    [dayId, setDayId] = useState("day-" + weekday(initialDate ?? today)),
    [date, setDate] = useState(initialDate ?? today),
    [restEnd, setRestEnd] = useState<number | null>(
      () => Number(localStorage.getItem("hybrid-rest-end")) || null,
    ),
    [now, setNow] = useState(Date.now()),
    [summary, setSummary] = useState(false),
    [substitute, setSubstitute] = useState<string | null>(null),
    [replacement, setReplacement] = useState(""),
    [historyFilter, setHistoryFilter] = useState("");
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (restEnd && now >= restEnd) {
      setRestEnd(null);
      localStorage.removeItem("hybrid-rest-end");
      if (data.profile.cues) {
        navigator.vibrate?.([200, 100, 200]);
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
          osc.onended = () => void ctx.close();
        } catch {
          /* device may block sound */
        }
      }
    }
  }, [now, restEnd, data.profile.cues]);
  const rest = (seconds: number) => {
    const end = Date.now() + seconds * 1000;
    setRestEnd(end);
    localStorage.setItem("hybrid-rest-end", String(end));
  };
  const p = data.programs.find((p) => p.id === programId) ?? data.programs[0],
    day = p?.days.find((d) => d.id === dayId) ?? p?.days[0],
    session = data.sessions.find((s) => s.id === sessionId);
  const save = (fn: (s: Session) => Session) =>
    update((d) => ({
      ...d,
      sessions: d.sessions.map((s) => (s.id === sessionId ? fn(s) : s)),
    }));
  const editExercise = (id: string, patch: Partial<SessionExercise>) =>
    save((s) => ({
      ...s,
      exercises: s.exercises.map((e) =>
        e.id === id
          ? {
              ...e,
              ...(patch.sets ||
              patch.form !== undefined ||
              patch.skipped !== undefined
                ? { decision: "pending" as const, suggestedWeight: null }
                : {}),
              ...patch,
            }
          : e,
      ),
    }));
  const editSet = (e: SessionExercise, id: string, patch: Partial<WorkSet>) =>
    editExercise(e.id, {
      sets: e.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  const start = () => {
    if (!p || !day) return;
    const s = createSession(p, day, week, date, data.sessions);
    update((d) => ({ ...d, sessions: [...d.sessions, s] }));
    setSessionId(s.id);
  };
  if (session) {
    const total = session.exercises
        .filter((e) => !e.skipped)
        .flatMap((e) => e.sets.filter((s) => !s.warmup)),
      done = total.filter((s) => s.complete).length,
      percent = total.length ? Math.round((done / total.length) * 100) : 0,
      seconds =
        session.elapsed +
        (session.runningSince ? (now - session.runningSince) / 1000 : 0),
      records = session.exercises.filter((e) =>
        e.sets.some(
          (s) =>
            s.complete &&
            !s.warmup &&
            s.weight !== null &&
            s.reps !== null &&
            s.reps > 0 &&
            s.weight >
              Math.max(
                0,
                ...data.sessions
                  .filter(
                    (x) =>
                      x.id !== session.id &&
                      x.status === "complete" &&
                      x.date <= session.date,
                  )
                  .flatMap((x) =>
                    x.exercises
                      .filter((x) => x.sourceId === e.sourceId)
                      .flatMap((x) =>
                        x.sets
                          .filter((x) => x.complete && !x.warmup && x.reps)
                          .map((x) => x.weight ?? 0),
                      ),
                  ),
              ),
        ),
      );
    return (
      <>
        <div className="row between wrap">
          <Button variant="ghost" onClick={() => setSessionId(null)}>
            <ArrowLeft size={17} /> All workouts
          </Button>
          <span className="pill">
            {session.status === "complete"
              ? "Completed session · editable"
              : "Workout in progress"}
          </span>
        </div>
        <div className="page-heading">
          <div>
            <div className="eyebrow">WEEK {session.week} / TRAINING LOG</div>
            <h1>{session.name}</h1>
            <p>Your entries save automatically.</p>
          </div>
        </div>
        <Card className="session-toolbar">
          <Field label="Workout date">
            <input
              type="date"
              required
              value={session.date}
              onChange={(e) =>
                e.target.value && save((s) => ({ ...s, date: e.target.value }))
              }
            />
          </Field>
          <div>
            <small>SESSION TIME</small>
            <strong className="timer-digits">
              {clock(seconds / 60) || "0:00"}
            </strong>
          </div>
          <Button
            variant="secondary"
            disabled={session.status === "complete"}
            onClick={() =>
              save((s) => ({
                ...s,
                elapsed:
                  s.elapsed +
                  (s.runningSince ? (Date.now() - s.runningSince) / 1000 : 0),
                runningSince: s.runningSince ? null : Date.now(),
              }))
            }
          >
            {session.runningSince ? <Pause size={17} /> : <Play size={17} />}{" "}
            {session.runningSince ? "Pause" : "Resume"}
          </Button>
          <div className="session-percent">
            <strong>{percent}%</strong>
            <small>
              {done} / {total.length} working sets
            </small>
          </div>
        </Card>
        {restEnd && (
          <div className="rest-banner" role="status">
            <Timer size={20} />
            <strong>Rest · {clock(Math.max(0, restEnd - now) / 60000)}</strong>
            <Button variant="ghost" onClick={() => rest(30)}>
              Reset 30s
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRestEnd(null);
                localStorage.removeItem("hybrid-rest-end");
              }}
            >
              Dismiss
            </Button>
          </div>
        )}
        {session.instructions && (
          <div className="callout">{session.instructions}</div>
        )}
        {(session.exercises.length === 0 || session.kind === "run") && (
          <Card>
            <h3>
              Log your{" "}
              {session.name.toLowerCase().includes("ruck") ? "ruck" : "session"}{" "}
              results
            </h3>
            <p>
              Endurance and recovery results are stored separately so you can
              track unscheduled sessions, too.
            </p>
            <div className="row wrap">
              <Button
                onClick={() =>
                  onEndurance(
                    session.name.toLowerCase().includes("ruck")
                      ? "ruck"
                      : "run",
                    session.date,
                  )
                }
              >
                Log run / ruck
              </Button>
              <Button
                variant="secondary"
                onClick={() => onRecovery(session.date)}
              >
                Recovery check-in
              </Button>
            </div>
          </Card>
        )}
        {session.exercises.map((e, index) => {
          const previous = data.sessions
              .filter(
                (s) =>
                  s.id !== session.id &&
                  (s.date !== session.date ||
                    (s.createdAt ?? 0) < (session.createdAt ?? Infinity)) &&
                  s.status === "complete" &&
                  s.date <= session.date,
              )
              .sort(newestFirst)
              .find((s) => s.exercises.some((x) => x.sourceId === e.sourceId)),
            prev = previous?.exercises.find((x) => x.sourceId === e.sourceId);
          const poor = data.measurements.some(
            (m) =>
              m.date === session.date &&
              ((m.fatigue ?? 0) >= 8 || (m.soreness ?? 0) >= 8),
          );
          const rec = recommendation(e, session.week, data.profile, poor),
            complete =
              e.sets.filter((s) => !s.warmup).length > 0 &&
              e.sets.filter((s) => !s.warmup).every((s) => s.complete);
          return (
            <Card
              key={e.id}
              className={e.skipped ? "exercise skipped" : "exercise"}
            >
              <div className="row between">
                <div className="row">
                  <span
                    className={`exercise-number ${complete ? "checked" : ""}`}
                  >
                    {complete ? (
                      <Check size={20} />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <div>
                    <h3>{e.name}</h3>
                    <p>
                      {e.target.sets} sets × {e.target.reps} {e.unit}{" "}
                      <span className="dot">·</span> RPE {e.target.rpe}{" "}
                      <span className="dot">·</span> Rest{" "}
                      {clock(e.target.rest / 60)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="icon"
                  aria-label={`Start rest for ${e.name}`}
                  onClick={() => rest(e.target.rest)}
                >
                  <Timer size={20} />
                </Button>
              </div>
              {e.technique && <p className="technique">{e.technique}</p>}
              <div className="previous">
                <span>LAST TIME</span>{" "}
                {prev
                  ? `${previous!.date} · ${
                      prev.sets
                        .filter((s) => s.complete && !s.warmup)
                        .map(
                          (s) =>
                            `${s.weight ?? "—"} lb × ${s.reps ?? "—"} @${s.rpe ?? "—"}`,
                        )
                        .join(" / ") || "No completed sets"
                    }`
                  : "No previous sets recorded."}
              </div>
              {!e.skipped && (
                <>
                  <div className="set-grid set-header">
                    <span>SET</span>
                    <span>
                      {e.name.toLowerCase().includes("pull-up")
                        ? "ADDED LB"
                        : "LB"}
                      {e.equipment === "Dumbbells" ? " / DB" : ""}
                    </span>
                    <span>{e.unit === "m" ? "METERS" : "REPS"}</span>
                    <span>RPE</span>
                    <span>DONE</span>
                    <span />
                  </div>
                  {e.sets.map((s, i) => (
                    <div
                      className={`set-grid ${s.complete ? "set-complete" : ""}`}
                      key={s.id}
                    >
                      <button
                        className="set-type"
                        title="Toggle warm-up or working set"
                        aria-label={`Set ${i + 1}: ${s.warmup ? "warm-up" : "working"}. Toggle type`}
                        onClick={() => editSet(e, s.id, { warmup: !s.warmup })}
                      >
                        {s.warmup ? "W" : i + 1}
                      </button>
                      <NumberInput
                        aria-label={`${e.name} set ${i + 1} weight`}
                        value={s.weight}
                        onChange={(weight) => editSet(e, s.id, { weight })}
                        placeholder={
                          i ? String(e.sets[i - 1].weight ?? "—") : "—"
                        }
                      />
                      <NumberInput
                        aria-label={`${e.name} set ${i + 1} repetitions or meters`}
                        value={s.reps}
                        onChange={(reps) => editSet(e, s.id, { reps })}
                        placeholder="—"
                      />
                      <NumberInput
                        aria-label={`${e.name} set ${i + 1} RPE`}
                        max={10}
                        value={s.rpe}
                        onChange={(rpe) => editSet(e, s.id, { rpe })}
                        placeholder="—"
                      />
                      <input
                        type="checkbox"
                        aria-label={`Complete ${e.name} set ${i + 1}`}
                        checked={s.complete}
                        onChange={(ev) => {
                          editSet(e, s.id, { complete: ev.target.checked });
                          if (ev.target.checked && session.status === "active")
                            rest(e.target.rest);
                        }}
                      />
                      <div className="set-actions">
                        <button
                          aria-label={`Move set ${i + 1} up`}
                          disabled={!i}
                          onClick={() => {
                            const a = [...e.sets];
                            [a[i - 1], a[i]] = [a[i], a[i - 1]];
                            editExercise(e.id, { sets: a });
                          }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          aria-label={`Delete set ${i + 1}`}
                          onClick={() =>
                            confirmDelete("this set") &&
                            editExercise(e.id, {
                              sets: e.sets.filter((x) => x.id !== s.id),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="row wrap">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        editExercise(e.id, {
                          sets: [
                            ...e.sets,
                            {
                              id: uid(),
                              weight: e.sets.at(-1)?.weight ?? null,
                              reps: null,
                              rpe: null,
                              complete: false,
                              warmup: false,
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={16} /> Add set
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        editExercise(e.id, {
                          sets: [
                            ...e.sets,
                            {
                              id: uid(),
                              weight: null,
                              reps: null,
                              rpe: null,
                              complete: false,
                              warmup: true,
                            },
                          ],
                        })
                      }
                    >
                      + Warm-up
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        let previousWeight: number | null = null;
                        editExercise(e.id, {
                          sets: e.sets.map((s) => {
                            const weight =
                              !s.complete && s.weight === null
                                ? previousWeight
                                : s.weight;
                            previousWeight = weight;
                            return { ...s, weight };
                          }),
                        });
                      }}
                    >
                      <Copy size={15} /> Copy previous weights
                    </Button>
                  </div>
                  <small>
                    Tap a set number to toggle warm-up. Dumbbell loads are per
                    hand, except carries (total load).
                  </small>
                </>
              )}
              <div className="row wrap exercise-options">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={e.pain}
                    onChange={(ev) =>
                      editExercise(e.id, {
                        pain: ev.target.checked,
                        decision: "pending",
                      })
                    }
                  />{" "}
                  Pain or symptoms
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={e.form}
                    onChange={(ev) =>
                      editExercise(e.id, { form: ev.target.checked })
                    }
                  />{" "}
                  Excellent form
                </label>
                <Button
                  variant="ghost"
                  onClick={() => editExercise(e.id, { skipped: !e.skipped })}
                >
                  {e.skipped ? "Restore exercise" : "Skip"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSubstitute(e.id);
                    setReplacement(e.name);
                  }}
                >
                  Substitute
                </Button>
              </div>
              <Field label="Exercise notes">
                <input
                  value={e.notes}
                  onChange={(ev) =>
                    editExercise(e.id, { notes: ev.target.value })
                  }
                  placeholder="Technique, equipment, how it felt…"
                />
              </Field>
              {session.status === "complete" && (
                <div className="recommendation">
                  <strong>
                    Next exposure{" "}
                    {rec.weight !== null ? `· ${rec.weight} lb` : ""}
                  </strong>
                  <p>{rec.reason}</p>
                  {e.decision === "pending" ? (
                    <div className="row">
                      <Button
                        variant="secondary"
                        disabled={rec.weight === null}
                        onClick={() =>
                          editExercise(e.id, {
                            decision: "accepted",
                            suggestedWeight: rec.weight,
                          })
                        }
                      >
                        Accept suggestion
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          editExercise(e.id, {
                            decision: "rejected",
                            suggestedWeight: null,
                          })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        editExercise(e.id, {
                          decision: "pending",
                          suggestedWeight: null,
                        })
                      }
                    >
                      Suggestion {e.decision} · reset
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        <Card>
          <Field label="Session notes">
            <textarea
              value={session.notes}
              onChange={(e) => save((s) => ({ ...s, notes: e.target.value }))}
            />
          </Field>
          <div className="row wrap">
            <Button
              onClick={() => {
                if (
                  session.status === "active" &&
                  percent < 100 &&
                  !confirm(
                    "Finish with incomplete sets? Only explicitly checked sets count toward performance.",
                  )
                )
                  return;
                save((s) => ({
                  ...s,
                  status: "complete",
                  elapsed:
                    s.elapsed +
                    (s.runningSince ? (Date.now() - s.runningSince) / 1000 : 0),
                  runningSince: null,
                }));
                setSummary(true);
              }}
            >
              <Flag size={17} />
              {session.status === "complete"
                ? "View summary"
                : "Finish workout"}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                onEndurance(
                  session.kind === "ruck"
                    ? "ruck"
                    : session.name.includes("Upper A")
                      ? "row"
                      : "run",
                  session.date,
                )
              }
            >
              Add endurance results
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete("this entire session")) {
                  update((d) => ({
                    ...d,
                    sessions: d.sessions.filter((x) => x.id !== session.id),
                  }));
                  setSessionId(null);
                }
              }}
            >
              Delete session
            </Button>
          </div>
        </Card>
        <Modal
          title="Session complete"
          open={summary}
          onClose={() => setSummary(false)}
        >
          <div className="summary-stat">
            {done}
            <small>working sets recorded</small>
          </div>
          <p>
            {session.name} · {Math.round(seconds / 60)} minutes · {percent}% of
            sets complete.
          </p>
          <h3>Load records</h3>
          <p>
            {records.length
              ? records.map((e) => e.name).join(", ")
              : "No new highest-load records this session."}
          </p>
          <p>
            Records compare completed working sets with repetitions against
            earlier sessions. Review optional progression suggestions under each
            exercise.
          </p>
          <Button onClick={() => setSummary(false)}>Review session</Button>
        </Modal>
        <Modal
          title="Substitute exercise"
          open={!!substitute}
          onClose={() => setSubstitute(null)}
        >
          <Field label="Replacement name">
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            />
          </Field>
          <p>
            This session only. A replacement gets a separate exercise history
            and blank sets.
          </p>
          <Button
            disabled={!replacement.trim()}
            onClick={() => {
              const e = session.exercises.find((e) => e.id === substitute)!;
              editExercise(e.id, {
                name: replacement.trim(),
                sourceId: replacement.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                sets: e.sets.map((s) => ({
                  ...s,
                  weight: null,
                  reps: null,
                  rpe: null,
                  complete: false,
                })),
                decision: "pending",
                suggestedWeight: null,
              });
              setSubstitute(null);
            }}
          >
            Use replacement
          </Button>
        </Modal>
      </>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Workouts</h1>
          <p>Your four-week training plan.</p>
        </div>
        <Button variant="secondary" onClick={onEditPlan}>
          Edit program
        </Button>
      </div>
      <div className="row wrap">
        <Field label="Training program">
          <select value={p?.id} onChange={(e) => setProgramId(e.target.value)}>
            {data.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Log date">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </Field>
      </div>
      <div className="week-tabs">
        {[1, 2, 3, 4].map((w) => (
          <button
            key={w}
            className={w === week ? "active" : ""}
            onClick={() => setWeek(w)}
          >
            Week {w}
            <small>
              {["Baseline", "Build", "Peak stimulus", "Deload"][w - 1]}
            </small>
          </button>
        ))}
      </div>
      <div className="workout-layout">
        <div className="day-list">
          {p?.days.map((d) => (
            <button
              key={d.id}
              className={day?.id === d.id ? "active" : ""}
              onClick={() => setDayId(d.id)}
            >
              <small>
                {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][d.weekday]}
              </small>
              <span>{d.name}</span>
            </button>
          ))}
        </div>
        {day && (
          <Card>
            <div className="eyebrow">
              WEEK {week} · {day.kind.toUpperCase()}
            </div>
            <h2>{day.name}</h2>
            <p>{day.notes}</p>
            {day.endurance[week - 1] && (
              <div className="callout">{day.endurance[week - 1]}</div>
            )}
            <div className="prescription-list">
              {day.exercises.map((e, index) => (
                <div className="row between" key={e.id}>
                  <span className="planned-exercise">
                    <span className="planned-number">{index + 1}</span>
                    <span>
                      {e.name}
                      <small>
                        {e.equipment} · Rest {e.weeks[week - 1].rest}s
                      </small>
                    </span>
                  </span>
                  <strong>
                    {e.weeks[week - 1].sets} × {e.weeks[week - 1].reps}
                  </strong>
                </div>
              ))}
            </div>
            <div className="row wrap">
              <Button onClick={start}>
                <Play size={17} /> Start workout
              </Button>
              {day.kind === "recovery" ? (
                <Button variant="secondary" onClick={() => onRecovery(date)}>
                  Recovery check-in
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() =>
                    onEndurance(
                      day.kind === "ruck"
                        ? "ruck"
                        : day.weekday === 2
                          ? "row"
                          : "run",
                      date,
                    )
                  }
                >
                  Log endurance
                </Button>
              )}
            </div>
            <p className="caption">
              RPE {week === 2 ? "7–8" : week === 3 ? "8" : "6–7"} ·{" "}
              {day.exercises.length} exercises · Automatically saved
            </p>
          </Card>
        )}
      </div>
      <div className="section-heading">
        <h2>Workout history</h2>
        <input
          aria-label="Filter workout history"
          placeholder="Search sessions…"
          value={historyFilter}
          onChange={(e) => setHistoryFilter(e.target.value)}
        />
      </div>
      {!data.sessions.length ? (
        <Card>
          <Empty
            title="Your first session starts here"
            detail="Start a workout above. Unfinished sessions stay ready to resume."
          />
        </Card>
      ) : (
        data.sessions
          .filter((s) =>
            `${s.name} ${s.date}`
              .toLowerCase()
              .includes(historyFilter.toLowerCase()),
          )
          .sort(newestFirst)
          .map((s) => (
            <button
              className="history-row"
              key={s.id}
              onClick={() => setSessionId(s.id)}
            >
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.date} · Week {s.week}
                </small>
              </div>
              <span className={s.status === "active" ? "pill" : "muted"}>
                {s.status === "active" ? "Resume →" : "Completed · Edit →"}
              </span>
            </button>
          ))
      )}
    </>
  );
}
