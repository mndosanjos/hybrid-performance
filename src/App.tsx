import { lazy, Suspense, useEffect, useState } from "react";
import {
  Activity,
  LayoutDashboard,
  Dumbbell,
  Utensils,
  TrendingUp,
  Settings as SettingsIcon,
  ArrowUpRight,
  Plus,
  Play,
  Check,
  WifiOff,
  ShieldCheck,
  Menu,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useStore } from "./store";
import { useToday } from "./useToday";
import { Button, Card, MacroBars } from "./components";
import {
  addDays,
  clock,
  localDate,
  monday,
  newestFirst,
  pace,
  totals,
  weekNumber,
  weekday,
  weekStats,
} from "./logic";
import { Endurance, Measurement } from "./model";
import Workouts, { createSession } from "./Workouts";
import Nutrition, { goalsFor } from "./Nutrition";
const Progress = lazy(() => import("./Progress"));
import Settings from "./Settings";
import ProgramEditor from "./ProgramEditor";
import {
  EnduranceDialog,
  MeasurementDialog,
  newEndurance,
  newMeasurement,
} from "./LogDialogs";
const tabs = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Workouts", icon: Dumbbell },
  { name: "Nutrition", icon: Utensils },
  { name: "Progress", icon: TrendingUp },
  { name: "Settings", icon: SettingsIcon },
] as const;
type Tab = (typeof tabs)[number]["name"];
export default function App() {
  const { data, update, saving, error, retry, flush } = useStore(),
    today = useToday(data.profile.timezone);
  const [workoutDate, setWorkoutDate] = useState(today);
  const [tab, setTab] = useState<Tab>("Dashboard"),
    [sessionId, setSessionId] = useState<string | null>(null),
    [editor, setEditor] = useState(false),
    [nutritionDate, setNutritionDate] = useState(today),
    [quickFood, setQuickFood] = useState(false),
    [endurance, setEndurance] = useState<Endurance | null>(null),
    [measurement, setMeasurement] = useState<Measurement | null>(null),
    [online, setOnline] = useState(navigator.onLine);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const fn = () => setOnline(navigator.onLine);
    window.addEventListener("online", fn);
    window.addEventListener("offline", fn);
    return () => {
      window.removeEventListener("online", fn);
      window.removeEventListener("offline", fn);
    };
  }, []);
  const navigate = (t: Tab) => {
    setTab(t);
    setEditor(false);
    window.scrollTo({ top: 0 });
  };
  const logFood = () => {
    setNutritionDate(today);
    setQuickFood(true);
    navigate("Nutrition");
  };
  const logEndurance = (kind: Endurance["kind"], date = today) =>
    setEndurance(newEndurance(date, kind));
  const program = data.programs.find((p) => !p.archived) ?? data.programs[0],
    day =
      program?.days.find((d) => d.weekday === weekday(today)) ??
      program?.days[0],
    week = weekNumber(program?.start ?? today, today),
    unfinished = data.sessions
      .filter((s) => s.status === "active")
      .sort(newestFirst)[0],
    todayComplete = data.sessions.some(
      (s) => s.date === today && s.dayId === day?.id && s.status === "complete",
    ),
    startToday = () => {
      if (unfinished) {
        setSessionId(unfinished.id);
      } else if (program && day) {
        const s = createSession(program, day, week, today, data.sessions);
        update((d) => ({ ...d, sessions: [...d.sessions, s] }));
        setSessionId(s.id);
      }
      navigate("Workouts");
    };
  const food = totals(
      data.foodLogs.filter((l) => l.date === today).map((l) => l.macros),
    ),
    measurements = data.measurements
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date)),
    weight =
      measurements.find((m) => m.weight !== null)?.weight ??
      data.profile.startingWeight,
    pullups = Math.max(
      data.profile.pullups,
      ...measurements.map((m) => m.pullups ?? 0),
    ),
    runTime = Math.min(
      data.profile.runPR,
      ...data.endurance
        .filter(
          (e) =>
            e.kind === "run" &&
            Math.abs(e.distance - 3) < 0.01 &&
            e.minutes > 0,
        )
        .map((e) => e.minutes),
    ),
    ruck = data.endurance
      .filter((e) => e.kind === "ruck")
      .sort((a, b) => b.date.localeCompare(a.date))[0],
    stats = weekStats(data.sessions, today),
    weekStart = monday(today);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={26} />
          </div>
          <span>
            HYBRID<small>PERFORMANCE</small>
          </span>
        </div>
        <div className="sidebar-section">HYBRID PERFORMANCE</div>
        <nav aria-label="Main navigation">
          {tabs.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => navigate(name)}
              aria-current={tab === name ? "page" : undefined}
            >
              <Icon size={20} />
              <span>{name}</span>
              {tab === name && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="athlete-avatar">HP</div>
          <div>
            <strong>{data.profile.name}</strong>
            <small>
              Hybrid athlete · Month {Math.floor((week - 1) / 4) + 1}
            </small>
          </div>
          <ShieldCheck size={18} />
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="mobile-brand">
            <Activity size={22} /> HYBRID
          </div>
          <div className="breadcrumb">
            Hybrid <span>/</span> {tab}
          </div>
          <div className="row">
            <span
              className={`save-status ${error ? "error" : ""}`}
              role="status"
            >
              <i />
              {error
                ? "Save needs attention"
                : saving
                  ? "Saving…"
                  : "Saved on device"}
            </span>
            {!online && <WifiOff size={17} aria-label="Offline" />}
            <div className="avatar">
              {data.profile.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main id="main-content">
          {error && (
            <div className="error-banner" role="alert">
              {error}{" "}
              <Button variant="secondary" onClick={retry}>
                Retry save
              </Button>
              <Button variant="secondary" onClick={() => navigate("Settings")}>
                Backup data
              </Button>
            </div>
          )}
          {offlineReady && (
            <div className="callout row between" role="status">
              Ready for offline use on this device.
              <Button variant="ghost" onClick={() => setOfflineReady(false)}>
                Dismiss
              </Button>
            </div>
          )}
          {needRefresh && (
            <div className="callout row between">
              A new app version is ready.
              <Button
                variant="secondary"
                onClick={async () => {
                  await flush();
                  await updateServiceWorker(true);
                }}
              >
                Save & update
              </Button>
            </div>
          )}
          {tab === "Dashboard" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {new Date(today + "T12:00:00")
                      .toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                      .toUpperCase()}
                  </div>
                  <h1>Today</h1>
                  <p>Your workout and daily nutrition.</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setMeasurement(newMeasurement(today))}
                >
                  <Plus size={17} /> Check in
                </Button>
              </div>
              <div className="dashboard-top">
                <Card className="hero-card">
                  <div className="row between">
                    <span className="eyebrow">
                      {unfinished
                        ? `UNFINISHED · ${unfinished.date}`
                        : "TODAY’S WORKOUT"}
                    </span>
                    <span className="pill">
                      WEEK {unfinished?.week ?? week} OF 4
                    </span>
                  </div>
                  <h2>
                    {unfinished
                      ? unfinished.name
                      : (day?.name ?? "Your next workout")}
                  </h2>
                  <p>
                    {unfinished
                      ? "In progress · your sets are saved."
                      : day?.notes || "Follow your programmed sets below."}
                  </p>
                  <div className="hero-meta">
                    <span>
                      <Dumbbell size={16} />{" "}
                      {unfinished?.exercises.length ??
                        day?.exercises.length ??
                        0}{" "}
                      exercises
                    </span>
                    <span>
                      <Activity size={16} /> RPE{" "}
                      {(unfinished?.week ?? week) === 3
                        ? "8"
                        : (unfinished?.week ?? week) === 2
                          ? "7–8"
                          : "6–7"}
                    </span>
                    <span>
                      {unfinished ? (
                        "In progress"
                      ) : todayComplete ? (
                        <>
                          <Check size={16} /> Completed today
                        </>
                      ) : (
                        "Not started"
                      )}
                    </span>
                  </div>
                  <div className="workout-preview">
                    {(unfinished
                      ? unfinished.exercises.map((e) => ({
                          id: e.id,
                          name: e.name,
                          target: e.target,
                        }))
                      : (day?.exercises ?? []).map((e) => ({
                          id: e.id,
                          name: e.name,
                          target: e.weeks[week - 1],
                        }))
                    )
                      .slice(0, 3)
                      .map((e) => (
                        <div key={e.id}>
                          <span>{e.name}</span>
                          <strong>
                            {e.target.sets} × {e.target.reps}
                          </strong>
                        </div>
                      ))}
                  </div>
                  <div className="row wrap">
                    <Button onClick={startToday}>
                      <Play size={17} />
                      {unfinished
                        ? "Resume workout"
                        : todayComplete
                          ? "Start another session"
                          : "Start workout"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSessionId(null);
                        navigate("Workouts");
                      }}
                    >
                      View program <ArrowUpRight size={17} />
                    </Button>
                  </div>
                  <div className="hero-footer">
                    <i /> {program?.name}{" "}
                  </div>
                </Card>
                <Card className="fuel-card">
                  <div className="row between">
                    <div className="eyebrow">NUTRITION</div>
                    <Utensils size={18} />
                  </div>
                  <h2>
                    {Math.round(food.calories).toLocaleString()}{" "}
                    <small>kcal</small>
                  </h2>
                  <MacroBars consumed={food} goals={goalsFor(data, today)} />
                  <Button variant="secondary" onClick={logFood}>
                    <Plus size={16} /> Log food
                  </Button>
                </Card>
              </div>
              <div className="section-heading">
                <h2>Your stats</h2>
                <Button variant="ghost" onClick={() => navigate("Progress")}>
                  All progress <ArrowUpRight size={16} />
                </Button>
              </div>
              <div className="metric-grid">
                <Card>
                  <small>BODY WEIGHT</small>
                  <strong className="metric">
                    {weight}
                    <em> lb</em>
                  </strong>
                  <p>
                    {measurements.some((m) => m.weight !== null)
                      ? "Latest check-in"
                      : "Starting baseline"}
                  </p>
                </Card>
                <Card>
                  <small>STRICT PULL-UPS</small>
                  <strong className="metric">
                    {pullups}
                    <em> reps</em>
                  </strong>
                  <p>Best including profile baseline</p>
                </Card>
                <Card>
                  <small>THREE-MILE RUN</small>
                  <strong className="metric">{clock(runTime)}</strong>
                  <p>{clock(runTime / 3)} /mi · best incl. baseline</p>
                </Card>
                <Card>
                  <small>LATEST RUCK PACE</small>
                  <strong className="metric">
                    {ruck ? clock(pace(ruck.minutes, ruck.distance)) : "—"}
                    <em>{ruck ? " /mi" : ""}</em>
                  </strong>
                  <p>
                    {ruck
                      ? `${ruck.distance} mi · ${ruck.dryWeight} lb dry`
                      : "No rucks logged"}
                  </p>
                </Card>
              </div>
              <Card className="weekly-card">
                <div className="row between wrap">
                  <div>
                    <h2>This week</h2>
                  </div>
                  <span className="pill">
                    {stats.sessions} sessions completed
                  </span>
                </div>
                <div className="calendar-strip">
                  {Array.from({ length: 7 }, (_, i) => {
                    const date = addDays(weekStart, i),
                      scheduled =
                        program?.days.filter((d) => d.weekday === i) ?? [],
                      done = scheduled.filter(
                        (d) =>
                          data.sessions.some(
                            (s) =>
                              s.status === "complete" &&
                              s.dayId === d.id &&
                              s.date === date,
                          ) ||
                          (d.kind === "run" &&
                            data.endurance.some(
                              (e) => e.kind === "run" && e.date === date,
                            )) ||
                          (d.kind === "ruck" &&
                            data.endurance.some(
                              (e) => e.kind === "ruck" && e.date === date,
                            )) ||
                          (d.kind === "recovery" &&
                            data.measurements.some((m) => m.date === date)),
                      ),
                      allDone =
                        scheduled.length > 0 &&
                        done.length === scheduled.length;
                    return (
                      <button
                        key={date}
                        className={`${date === today ? "today" : ""} ${allDone ? "done" : ""}`}
                        onClick={() => {
                          setWorkoutDate(date);
                          setSessionId(null);
                          navigate("Workouts");
                        }}
                      >
                        <small>
                          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i]}
                        </small>
                        <strong>{date.slice(-2)}</strong>
                        <span>
                          {scheduled[0]?.kind === "recovery"
                            ? "Recovery"
                            : (scheduled[0]?.kind ?? "Rest")}
                        </span>
                        <i>
                          {allDone ? (
                            <Check size={14} />
                          ) : date < today ? (
                            "—"
                          ) : date === today ? (
                            "●"
                          ) : (
                            "·"
                          )}
                        </i>
                        <small>
                          {allDone
                            ? "Complete"
                            : date < today
                              ? "Not logged"
                              : "Pending"}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <p className="caption">
                  Completed days use recorded sessions, endurance logs, or
                  recovery check-ins. A dash means a past planned day has no
                  matching log.
                </p>
              </Card>
              <div className="quick-actions">
                <button onClick={startToday}>
                  <Dumbbell />
                  <span>Start workout</span>
                  <ArrowUpRight />
                </button>
                <button onClick={logFood}>
                  <Utensils />
                  <span>Log food</span>
                  <ArrowUpRight />
                </button>
                <button onClick={() => setMeasurement(newMeasurement(today))}>
                  <TrendingUp />
                  <span>Log weight</span>
                  <ArrowUpRight />
                </button>
                <button onClick={() => logEndurance("run")}>
                  <Activity />
                  <span>Log run / ruck</span>
                  <ArrowUpRight />
                </button>
              </div>
            </>
          )}
          {tab === "Workouts" &&
            (editor ? (
              <ProgramEditor onClose={() => setEditor(false)} />
            ) : (
              <Workouts
                key={workoutDate}
                initialDate={workoutDate}
                sessionId={sessionId}
                setSessionId={setSessionId}
                onEndurance={logEndurance}
                onRecovery={(date = today) =>
                  setMeasurement(newMeasurement(date))
                }
                onEditPlan={() => setEditor(true)}
              />
            ))}
          {tab === "Nutrition" && (
            <Nutrition
              key={quickFood ? "quick" : "normal"}
              date={nutritionDate}
              setDate={setNutritionDate}
              quickOpen={quickFood}
              onQuickHandled={() => {
                /* handled when navigating away; keep the form mounted */
              }}
            />
          )}
          {tab === "Progress" && (
            <Suspense fallback={<Card>Loading progress…</Card>}>
              <Progress
                onEndurance={setEndurance}
                onMeasurement={setMeasurement}
              />
            </Suspense>
          )}
          {tab === "Settings" && <Settings />}
          <footer className="page-footer">
            <span>HYBRID PERFORMANCE</span>
            <span>Stored on this device</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {tabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => {
              setQuickFood(false);
              navigate(name);
            }}
            aria-current={tab === name ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {endurance && (
        <EnduranceDialog
          key={endurance.id}
          initial={endurance}
          onClose={() => setEndurance(null)}
        />
      )}
      {measurement && (
        <MeasurementDialog
          key={measurement.id}
          initial={measurement}
          onClose={() => setMeasurement(null)}
        />
      )}
    </div>
  );
}
