import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { useStore } from "./store";
import { Button, Card, Empty, Field } from "./components";
import { Endurance, Measurement } from "./model";
import {
  addDays,
  clock,
  localDate,
  monday,
  pace,
  totals,
  weekStats,
} from "./logic";
import { goalsFor } from "./Nutrition";
export function Trend({
  data,
  lines,
  goal,
}: {
  data: Record<string, unknown>[];
  lines: { key: string; label: string; color: string }[];
  goal?: number;
}) {
  return data.length ? (
    <div
      className="chart"
      role="img"
      aria-label={`${lines.map((l) => l.label).join(", ")} trend across ${data.length} recorded dates`}
    >
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 18, left: -12, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#29332e"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "#91a49a", fontSize: 11 }}
            tickFormatter={(s) => String(s).slice(5)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#91a49a", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#17221c",
              border: "1px solid #3c5145",
              borderRadius: 12,
            }}
          />
          <Legend />
          {lines.map((l) => (
            <Line
              key={l.key}
              name={l.label}
              dataKey={l.key}
              type="monotone"
              stroke={l.color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
          {goal !== undefined && (
            <ReferenceLine
              y={goal}
              stroke="#a6b9ad"
              strokeDasharray="4 4"
              label={{ value: "Goal", fill: "#a6b9ad" }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <Empty
      title="Let your progress tell the story"
      detail="Recorded results will appear here. Your goals are never shown as completed performances."
    />
  );
}
export default function Progress({
  onEndurance,
  onMeasurement,
}: {
  onEndurance: (e: Endurance) => void;
  onMeasurement: (m: Measurement) => void;
}) {
  const { data } = useStore(),
    today = localDate(data.profile.timezone),
    [month, setMonth] = useState(today.slice(0, 7)),
    [exercise, setExercise] = useState("barbell-bench-press");
  const start = month + "-01",
    next = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1))
      .toISOString()
      .slice(0, 10),
    prevStart = new Date(
      Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 2, 1),
    )
      .toISOString()
      .slice(0, 10);
  const within = (x: { date: string }) => x.date >= start && x.date < next,
    measurements = data.measurements
      .filter(within)
      .sort((a, b) => a.date.localeCompare(b.date)),
    endurance = data.endurance
      .filter(within)
      .sort((a, b) => a.date.localeCompare(b.date)),
    completed = data.sessions.filter((s) => s.status === "complete"),
    exercises = new Map(
      completed.flatMap((s) =>
        s.exercises.map((e) => [e.sourceId, e.name] as const),
      ),
    );
  const strength = completed
    .filter(within)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) =>
      s.exercises
        .filter((e) => e.sourceId === exercise)
        .map((e) => ({
          date: s.date,
          load: Math.max(
            0,
            ...e.sets
              .filter((s) => s.complete && !s.warmup && (s.reps ?? 0) > 0)
              .map((s) => s.weight ?? 0),
          ),
        })),
    );
  const body = measurements
    .filter((m) => m.weight !== null)
    .map((m) => {
      const range = data.measurements.filter(
        (x) =>
          x.weight !== null &&
          x.date <= m.date &&
          x.date >= addDays(m.date, -6),
      );
      return {
        date: m.date,
        weight: m.weight,
        average:
          Math.round(
            (range.reduce((a, x) => a + x.weight!, 0) / range.length) * 10,
          ) / 10,
      };
    });
  const run = endurance.filter((e) => e.kind === "run" && e.distance > 0),
    ruck = endurance.filter((e) => e.kind === "ruck" && e.distance > 0),
    allRucks = data.endurance.filter(
      (e) => e.kind === "ruck" && e.distance > 0,
    ),
    latest = allRucks.sort((a, b) => b.date.localeCompare(a.date))[0],
    bestDistance = Math.max(
      0,
      ...allRucks
        .filter((e) => e.dryWeight >= data.profile.ruckWeight)
        .map((e) => e.distance),
    );
  const achieved = allRucks.some(
    (e) =>
      e.distance >= data.profile.ruckMiles &&
      e.dryWeight >= data.profile.ruckWeight &&
      pace(e.minutes, e.distance) <= data.profile.ruckPace &&
      e.minutes > 0,
  );
  const nutrition = Array.from(
    new Set(data.foodLogs.filter(within).map((f) => f.date)),
  )
    .sort()
    .map((date) => {
      const t = totals(
        data.foodLogs.filter((f) => f.date === date).map((f) => f.macros),
      );
      return { date, ...t, target: goalsFor(data, date).calories };
    });
  const weeks = Array.from(new Set(endurance.map((e) => monday(e.date))))
    .sort()
    .map((date) => {
      const entries = endurance.filter((e) => monday(e.date) === date);
      return {
        date,
        run: entries
          .filter((e) => e.kind === "run")
          .reduce((a, e) => a + e.distance, 0),
        ruck: entries
          .filter((e) => e.kind === "ruck")
          .reduce((a, e) => a + e.distance * (e.dryWeight + e.extraWeight), 0),
      };
    });
  const currentCount = completed.filter(within).length,
    previousCount = completed.filter(
      (s) => s.date >= prevStart && s.date < start,
    ).length,
    stats = weekStats(data.sessions, today);
  const bestThreeMile = Math.min(
    ...data.endurance
      .filter(
        (e) =>
          e.kind === "run" && Math.abs(e.distance - 3) < 0.01 && e.minutes > 0,
      )
      .map((e) => e.minutes),
  );
  const periodMetrics = (from: string, until: string) => {
    const inPeriod = (x: { date: string }) => x.date >= from && x.date < until;
    const ms = data.measurements.filter(inPeriod),
      es = data.endurance.filter(inPeriod),
      ss = completed.filter(inPeriod),
      fs = data.foodLogs.filter(inPeriod);
    const avg = (v: number[]) =>
      v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "—";
    const best = (id: string) => {
      const loads = ss.flatMap((s) =>
        s.exercises
          .filter((e) => e.sourceId === id && !e.skipped)
          .flatMap((e) =>
            e.sets
              .filter(
                (s) =>
                  s.complete &&
                  !s.warmup &&
                  (s.reps ?? 0) > 0 &&
                  s.weight !== null,
              )
              .map((s) => s.weight!),
          ),
      );
      return loads.length ? String(Math.max(...loads)) : "—";
    };
    const days = new Set(fs.map((f) => f.date)).size,
      t = totals(fs.map((f) => f.macros));
    return [
      String(ss.length),
      avg(ms.flatMap((m) => (m.weight === null ? [] : [m.weight]))),
      avg(ms.flatMap((m) => (m.waist === null ? [] : [m.waist]))),
      best("barbell-bench-press"),
      best("barbell-back-squat"),
      clock(
        Math.min(
          ...es
            .filter(
              (e) =>
                e.kind === "run" &&
                Math.abs(e.distance - 3) < 0.01 &&
                e.minutes > 0,
            )
            .map((e) => e.minutes),
        ),
      ),
      es
        .filter((e) => e.kind === "ruck")
        .reduce((a, e) => a + e.distance, 0)
        .toFixed(1),
      days ? String(Math.round(t.calories / days)) : "—",
      days ? String(Math.round(t.protein / days)) : "—",
    ];
  };
  const currentMetrics = periodMetrics(start, next),
    previousMetrics = periodMetrics(prevStart, start);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Progress</h1>
          <p>Training history and performance trends.</p>
        </div>
        <Field label="Compare month">
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </Field>
      </div>
      <div className="metric-grid">
        <Card>
          <small>SESSIONS THIS MONTH</small>
          <strong className="metric">{currentCount}</strong>
          <p>{previousCount} previous month</p>
        </Card>
        <Card>
          <small>THIS WEEK</small>
          <strong className="metric">{stats.sessions}</strong>
          <p>{stats.sets} working sets completed</p>
        </Card>
        <Card>
          <small>RUNNING THIS MONTH</small>
          <strong className="metric">
            {run.reduce((a, e) => a + e.distance, 0).toFixed(1)}
            <em> mi</em>
          </strong>
          <p>{run.length} recorded runs</p>
        </Card>
        <Card>
          <small>NUTRITION CONSISTENCY</small>
          <strong className="metric">
            {
              nutrition.filter(
                (n) => n.protein >= goalsFor(data, n.date).protein,
              ).length
            }
            <em> days</em>
          </strong>
          <p>Protein target met · {nutrition.length} days logged</p>
        </Card>
      </div>
      <Card>
        <h3>Monthly comparison</h3>
        <p>
          Recorded results only. A dash means no measurement; nutrition averages
          use logged days only.
        </p>
        <div className="table-scroll">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>{prevStart.slice(0, 7)}</th>
                <th>{month}</th>
              </tr>
            </thead>
            <tbody>
              {[
                "Completed sessions",
                "Average weight (lb)",
                "Average waist (in)",
                "Best bench load (lb)",
                "Best squat load (lb)",
                "Best 3-mile run (min:sec)",
                "Ruck distance (mi)",
                "Calories / logged day",
                "Protein g / logged day",
              ].map((label, i) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>{previousMetrics[i]}</td>
                  <td>{currentMetrics[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="two-col">
        <Card>
          <div className="eyebrow">BODY COMPOSITION</div>
          <h3>Weight & seven-day trend</h3>
          <p>
            Starting baseline {data.profile.startingWeight} lb · no target body
            weight assumed
          </p>
          <Trend
            data={body}
            lines={[
              { key: "weight", label: "Weight (lb)", color: "#6ee7b7" },
              {
                key: "average",
                label: "7-day recorded average",
                color: "#a5b4fc",
              },
            ]}
          />
        </Card>
        <Card>
          <div className="row between wrap">
            <h3>Strength progression</h3>
            <select
              aria-label="Exercise for strength chart"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
            >
              {!exercises.size && (
                <option value="barbell-bench-press">Barbell bench press</option>
              )}
              {[...exercises].map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <p>
            Highest completed working-set load (lb). Pull-ups use added load.
          </p>
          <Trend
            data={strength}
            lines={[{ key: "load", label: "Best load (lb)", color: "#6ee7b7" }]}
          />
        </Card>
        <Card>
          <h3>Running pace</h3>
          <p>Minutes per mile · lower is faster · distance varies by session</p>
          <Trend
            data={run.map((e) => ({
              date: e.date,
              pace: +pace(e.minutes, e.distance).toFixed(2),
              rpe: e.rpe,
            }))}
            lines={[{ key: "pace", label: "min / mi", color: "#6ee7b7" }]}
          />
          <p>
            Best recorded 3-mile time:{" "}
            {Number.isFinite(bestThreeMile)
              ? clock(bestThreeMile)
              : "No recorded 3-mile run"}
          </p>
        </Card>
        <Card>
          <h3>Rucking pace</h3>
          <p>
            Minutes per mile · compare terrain and carried load in your logs
          </p>
          <Trend
            data={ruck.map((e) => ({
              date: e.date,
              pace: +pace(e.minutes, e.distance).toFixed(2),
            }))}
            lines={[{ key: "pace", label: "min / mi", color: "#b6c798" }]}
          />
        </Card>
      </div>
      <Card className="ruck-goal">
        <div>
          <div className="eyebrow">RUCK GOAL</div>
          <h2>
            {data.profile.ruckMiles} miles. {data.profile.ruckWeight} lb.{" "}
            {clock(data.profile.ruckPace)} pace.
          </h2>
          <p>
            Target finish:{" "}
            {clock(data.profile.ruckMiles * data.profile.ruckPace)} ·{" "}
            {achieved
              ? "Achieved in a recorded session"
              : "Future goal, not a completed result"}
          </p>
        </div>
        <div>
          <strong>
            {bestDistance.toFixed(2)} / {data.profile.ruckMiles} mi
          </strong>
          <div className="track">
            <i
              style={{
                width: `${Math.min(100, (bestDistance / data.profile.ruckMiles) * 100)}%`,
              }}
            />
          </div>
          <small>Longest logged at ≥{data.profile.ruckWeight} lb dry</small>
          <p>
            {latest
              ? `Latest: ${latest.distance} mi · ${clock(pace(latest.minutes, latest.distance))}/mi · ${latest.dryWeight} lb dry`
              : "Log your first ruck to establish a baseline."}
          </p>
        </div>
      </Card>
      <div className="two-col">
        <Card>
          <h3>Weekly endurance volume</h3>
          {weeks.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeks}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#91a49a", fontSize: 10 }}
                  />
                  <YAxis yAxisId="run" tick={{ fill: "#91a49a" }} />
                  <YAxis
                    yAxisId="ruck"
                    orientation="right"
                    tick={{ fill: "#91a49a" }}
                  />
                  <Tooltip contentStyle={{ background: "#17221c" }} />
                  <Legend />
                  <Bar
                    yAxisId="run"
                    dataKey="run"
                    name="Running miles"
                    fill="#6ee7b7"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="ruck"
                    dataKey="ruck"
                    name="Ruck lb × miles (total load)"
                    fill="#a5b4fc"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title="Build your base"
              detail="Weekly miles and load-carriage volume appear as you log activities."
            />
          )}
        </Card>
        <Card>
          <h3>Nutrition vs. target</h3>
          <Trend
            data={nutrition}
            lines={[
              { key: "calories", label: "Calories logged", color: "#6ee7b7" },
              { key: "target", label: "Calorie target", color: "#a5b4fc" },
            ]}
          />
          <p>
            Only logged days are plotted.{" "}
            {
              nutrition.filter(
                (n) => Math.abs(n.calories - n.target) <= n.target * 0.1,
              ).length
            }{" "}
            logged days within 10% of calorie target.
          </p>
        </Card>
      </div>
      <h2>Endurance history</h2>
      {endurance.length ? (
        endurance
          .slice()
          .reverse()
          .map((e) => (
            <button
              className="history-row"
              key={e.id}
              onClick={() => onEndurance(e)}
            >
              <div>
                <strong>
                  {e.kind.toUpperCase()} · {e.distance} mi · {clock(e.minutes)}
                </strong>
                <small>
                  {e.date} · {clock(pace(e.minutes, e.distance))}/mi · RPE{" "}
                  {e.rpe}
                  {e.kind === "ruck"
                    ? ` · ${e.dryWeight} lb dry / ${e.dryWeight + e.extraWeight} lb total`
                    : ""}
                  {e.symptoms ? ` · Symptoms: ${e.symptoms}` : ""}
                </small>
              </div>
              <span>Edit →</span>
            </button>
          ))
      ) : (
        <p className="muted">No endurance entries this month.</p>
      )}
      <h2>Body, recovery & photos</h2>
      <div className="measurement-grid">
        {measurements
          .slice()
          .reverse()
          .map((m) => (
            <button
              className="card measurement"
              key={m.id}
              onClick={() => onMeasurement(m)}
            >
              {m.photo && (
                <img
                  src={m.photo}
                  alt={`Progress on ${m.date}`}
                  loading="lazy"
                />
              )}
              <strong>{m.date}</strong>
              <p>
                {m.weight ?? "—"} lb · {m.waist ?? "—"} in waist ·{" "}
                {m.bodyFat ?? "—"}% estimate
              </p>
              <small>
                Pull-ups {m.pullups ?? "—"} · Sleep {m.sleep ?? "—"} h · Fatigue{" "}
                {m.fatigue ?? "—"} /10
              </small>
              <p>{m.notes}</p>
              <span>Edit check-in →</span>
            </button>
          ))}
      </div>
      {!measurements.length && (
        <p className="muted">
          No check-ins this month. Use Log weight to record measurements,
          recovery or photos.
        </p>
      )}
    </>
  );
}
