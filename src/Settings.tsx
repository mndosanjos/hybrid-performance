import { useState } from "react";
import { Download, Upload, ShieldCheck, Copy } from "lucide-react";
import { useStore } from "./store";
import {
  Button,
  Card,
  Field,
  NumberInput,
  Modal,
  download,
} from "./components";
import { Data, Profile, collections, profileSchema } from "./model";
import {
  addDays,
  coachReport,
  csv,
  localDate,
  macroKeys,
  mergeBackup,
  monday,
  validateBackup,
} from "./logic";
export default function Settings() {
  const { data, update, flush } = useStore(),
    today = localDate(data.profile.timezone),
    [profile, setProfile] = useState<Profile>(structuredClone(data.profile)),
    [message, setMessage] = useState(""),
    [incoming, setIncoming] = useState<Data | null>(null),
    [includeProfile, setIncludeProfile] = useState(false),
    [from, setFrom] = useState(monday(today)),
    [to, setTo] = useState(today),
    [report, setReport] = useState("");
  const put = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch });
  const backup = async () => {
    try {
      await flush();
    } catch {
      /* current in-memory data can still be exported */
    }
    download(
      `hybrid-performance-${today}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    setMessage(
      "Backup downloaded. Keep a copy somewhere outside this browser.",
    );
  };
  const workoutsCSV = () => {
    const rows: (string | number | null)[][] = [
      [
        "session_id",
        "date",
        "workout",
        "week",
        "status",
        "duration_seconds",
        "exercise",
        "set",
        "warmup",
        "weight_lb",
        "reps_or_meters",
        "unit",
        "rpe",
        "complete",
        "pain",
        "notes",
      ],
    ];
    for (const s of data.sessions)
      for (const e of s.exercises)
        e.sets.forEach((x, i) =>
          rows.push([
            s.id,
            s.date,
            s.name,
            s.week,
            s.status,
            Math.round(s.elapsed),
            e.name,
            i + 1,
            String(x.warmup),
            x.weight,
            x.reps,
            e.unit,
            x.rpe,
            String(x.complete),
            String(e.pain),
            e.notes,
          ]),
        );
    download("hybrid-workouts.csv", csv(rows), "text/csv");
  };
  const nutritionCSV = () =>
    download(
      "hybrid-nutrition.csv",
      csv([
        [
          "id",
          "date",
          "meal",
          "food",
          "quantity",
          "unit",
          "calories",
          "protein_g",
          "carbs_g",
          "fat_g",
        ],
        ...data.foodLogs.map((l) => [
          l.id,
          l.date,
          l.meal,
          l.name,
          l.quantity,
          l.unit,
          ...macroKeys.map((k) => l.macros[k]),
        ]),
      ]),
      "text/csv",
    );
  const enduranceCSV = () =>
    download(
      "hybrid-endurance.csv",
      csv([
        [
          "id",
          "date",
          "kind",
          "miles",
          "minutes",
          "rpe",
          "dry_lb",
          "extra_lb",
          "elevation_ft",
          "terrain",
          "symptoms",
          "notes",
        ],
        ...data.endurance.map((e) => [
          e.id,
          e.date,
          e.kind,
          e.distance,
          e.minutes,
          e.rpe,
          e.dryWeight,
          e.extraWeight,
          e.elevation,
          e.terrain,
          e.symptoms,
          e.notes,
        ]),
      ]),
      "text/csv",
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Your profile, your targets, your data.</p>
        </div>
        <span className="pill">
          <ShieldCheck size={14} /> Stored on this device
        </span>
      </div>
      {message && (
        <div className="callout" role="status">
          {message}
        </div>
      )}
      <Card>
        <h2>Athlete profile</h2>
        <div className="form-grid">
          <Field label="Display name">
            <input
              value={profile.name}
              onChange={(e) => put({ name: e.target.value })}
            />
          </Field>
          <Field label="Sex">
            <input
              value={profile.sex}
              onChange={(e) => put({ sex: e.target.value })}
            />
          </Field>
          {(
            [
              ["age", "Age"],
              ["height", "Height (inches)"],
              ["startingWeight", "Starting weight (lb)"],
              ["pullups", "Baseline strict pull-up max"],
              ["runPR", "Baseline three-mile time (minutes)"],
              ["ruckMiles", "Ruck target distance (miles)"],
              ["ruckWeight", "Ruck target dry load (lb)"],
              ["ruckPace", "Ruck target pace (min / mile)"],
              ["upperIncrement", "Upper-body load increment (lb)"],
              ["lowerIncrement", "Lower-body load increment (lb)"],
              ["maxDumbbell", "Maximum dumbbell (lb per hand)"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <NumberInput
                value={profile[key]}
                onChange={(v) => put({ [key]: v ?? 0 })}
              />
            </Field>
          ))}
          <Field label="Timezone (IANA name)">
            <input
              value={profile.timezone}
              onChange={(e) => put({ timezone: e.target.value })}
              placeholder="America/New_York"
            />
          </Field>
        </div>
        <p className="caption">
          Dates already logged stay fixed when timezone changes. The timezone
          controls which calendar date counts as today.
        </p>
        <Field label="Training background">
          <textarea
            value={profile.background}
            onChange={(e) => put({ background: e.target.value })}
          />
        </Field>
        <Field label="Goals">
          <textarea
            value={profile.goals}
            onChange={(e) => put({ goals: e.target.value })}
          />
        </Field>
        <Field label="Equipment inventory">
          <textarea
            value={profile.equipment}
            onChange={(e) => put({ equipment: e.target.value })}
          />
        </Field>
        <p className="caption">
          Equipment changes do not silently rewrite your plan. Use Program
          studio to substitute exercises. Confirm suggested load increments
          against the equipment you have.
        </p>
        <h3>Nutrition targets</h3>
        <div className="form-grid">
          {macroKeys.map((k) => (
            <Field
              key={k}
              label={`Daily ${k}${k === "calories" ? " (kcal)" : " (g)"}`}
            >
              <NumberInput
                value={profile.trainingGoals[k]}
                onChange={(v) =>
                  put({
                    trainingGoals: { ...profile.trainingGoals, [k]: v ?? 0 },
                  })
                }
              />
            </Field>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={profile.useRestGoals}
            onChange={(e) => put({ useRestGoals: e.target.checked })}
          />{" "}
          Use separate rest-day targets
        </label>
        {profile.useRestGoals && (
          <div className="form-grid">
            {macroKeys.map((k) => (
              <Field key={k} label={`Rest-day ${k}`}>
                <NumberInput
                  value={profile.restGoals[k]}
                  onChange={(v) =>
                    put({ restGoals: { ...profile.restGoals, [k]: v ?? 0 } })
                  }
                />
              </Field>
            ))}
          </div>
        )}
        <p className="caption">
          Macro energy:{" "}
          {Math.round(
            profile.trainingGoals.protein * 4 +
              profile.trainingGoals.carbs * 4 +
              profile.trainingGoals.fat * 9,
          )}{" "}
          kcal. Label rounding can differ from calorie targets.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={profile.cues}
            onChange={(e) => put({ cues: e.target.checked })}
          />{" "}
          Rest timer sound / vibration where supported
        </label>
        <Button
          onClick={() => {
            const parsed = profileSchema.safeParse(profile);
            if (!parsed.success) {
              setMessage(
                parsed.error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .join("; "),
              );
              return;
            }
            if (profile.ruckMiles <= 0 || profile.ruckPace <= 0) {
              setMessage(
                "Ruck target distance and pace must be greater than zero.",
              );
              return;
            }
            update((d) => ({ ...d, profile: parsed.data }));
            setMessage("Profile and targets saved.");
          }}
        >
          Save profile & targets
        </Button>
      </Card>
      <Card>
        <div className="eyebrow">DATA SAFETY</div>
        <h2>Local first. Yours always.</h2>
        <p>
          Your data lives in this device’s browser, not in a cloud account.
          Clearing site data, using private browsing, or losing a device can
          remove it. Export backups regularly, including before switching
          devices or hosting addresses. Photos are included in JSON backups.
        </p>
        <div className="row wrap">
          <Button onClick={backup}>
            <Download size={17} /> Full JSON backup
          </Button>
          <label className="btn secondary">
            <Upload size={17} /> Import backup
            <input
              className="sr-only"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 100000000)
                    throw Error("Backup is larger than 100 MB.");
                  const parsed = validateBackup(JSON.parse(await file.text()));
                  setIncoming(parsed);
                  setIncludeProfile(false);
                } catch (err) {
                  setMessage(
                    "Import rejected. No changes made. " + String(err),
                  );
                }
              }}
            />
          </label>
          <Button
            variant="secondary"
            onClick={async () => {
              const granted = await navigator.storage?.persist?.();
              setMessage(
                granted
                  ? "Persistent storage granted by this browser. Continue making backups."
                  : "This browser did not grant persistent storage. Regular backups are still available.",
              );
            }}
          >
            Request persistent storage
          </Button>
        </div>
        <div className="row wrap">
          <Button variant="ghost" onClick={workoutsCSV}>
            Workout CSV
          </Button>
          <Button variant="ghost" onClick={nutritionCSV}>
            Nutrition CSV
          </Button>
          <Button variant="ghost" onClick={enduranceCSV}>
            Endurance CSV
          </Button>
        </div>
      </Card>
      <Card>
        <div className="eyebrow">COACHING REPORT</div>
        <h2>Copy Progress for AI Coach</h2>
        <p>
          Choose a date range, then paste the report into your existing ChatGPT
          Fitness project. No API key and no automatic synchronization.
        </p>
        <div className="chips">
          <button
            onClick={() => {
              setFrom(today);
              setTo(today);
            }}
          >
            Today
          </button>
          <button
            onClick={() => {
              setFrom(monday(today));
              setTo(today);
            }}
          >
            This week
          </button>
          <button
            onClick={() => {
              setFrom(addDays(today, -6));
              setTo(today);
            }}
          >
            Last 7 days
          </button>
          <button
            onClick={() => {
              setFrom(today.slice(0, 7) + "-01");
              setTo(today);
            }}
          >
            Monthly review
          </button>
        </div>
        <div className="form-grid">
          <Field label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => e.target.value && setFrom(e.target.value)}
            />
          </Field>
          <Field label="Through">
            <input
              type="date"
              value={to}
              onChange={(e) => e.target.value && setTo(e.target.value)}
            />
          </Field>
        </div>
        <Button
          disabled={from > to}
          onClick={() => setReport(coachReport(data, from, to))}
        >
          Generate progress report
        </Button>
        {report && (
          <>
            <Field label="Report (editable before copying)">
              <textarea
                className="report"
                value={report}
                onChange={(e) => setReport(e.target.value)}
              />
            </Field>
            <div className="row wrap">
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(report);
                    setMessage(
                      "Progress report copied. Paste it into ChatGPT.",
                    );
                  } catch {
                    setMessage(
                      "Clipboard unavailable. Select and copy the report manually, or download it.",
                    );
                  }
                }}
              >
                <Copy size={16} /> Copy report
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  download(`hybrid-coach-${from}-${to}.txt`, report)
                }
              >
                Download text
              </Button>
            </div>
          </>
        )}
      </Card>
      <Card>
        <h3>Install on your phone</h3>
        <p>
          Open the deployed HTTPS address in Safari on iPhone, then Share → Add
          to Home Screen. On Android, use Chrome → Install app / Add to Home
          screen. Open the app online once and wait for the offline-ready
          message before relying on offline use.
        </p>
        <p>
          There is no automatic sync between browsers or devices. Export JSON
          here and import it on your other device.
        </p>
      </Card>
      <Modal
        title="Review backup import"
        open={!!incoming}
        onClose={() => setIncoming(null)}
      >
        {incoming && (
          <>
            <p>
              Version {incoming.version} backup. Import adds new IDs only.
              Existing records with matching IDs are kept unchanged, even if the
              backup is newer.
            </p>
            <ul>
              {collections.map((k) => (
                <li key={k}>
                  {k}: {incoming[k].length} records
                </li>
              ))}
            </ul>
            <p>
              <strong>{mergeBackup(data, incoming).added} new records</strong>{" "}
              will be added.{" "}
              <strong>
                {mergeBackup(data, incoming).conflicts} existing IDs
              </strong>{" "}
              will be skipped.
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={includeProfile}
                onChange={(e) => setIncludeProfile(e.target.checked)}
              />{" "}
              Explicitly replace my profile and nutrition goals with the
              backup’s profile
            </label>
            <p>
              Imported programs are archived; activate one by saving it in
              Program studio. Existing workout logs are never overwritten.
            </p>
            <Button
              onClick={() => {
                const source = {
                  ...incoming,
                  programs: incoming.programs.map((p) => ({
                    ...p,
                    archived: true,
                  })),
                };
                update((d) => {
                  const merged = mergeBackup(d, source).data;
                  return includeProfile
                    ? { ...merged, profile: source.profile }
                    : merged;
                });
                if (includeProfile) setProfile(structuredClone(source.profile));
                setIncoming(null);
                setMessage(
                  "Backup merged. Existing record IDs were preserved.",
                );
              }}
            >
              Confirm merge import
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}
