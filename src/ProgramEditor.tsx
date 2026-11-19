import { useState } from "react";
import { Plus, Trash2, Copy, ArrowLeft, ChevronUp } from "lucide-react";
import { useStore } from "./store";
import { Button, Card, Field, NumberInput, confirmDelete } from "./components";
import { Day, Exercise, Program, uid } from "./model";
import { addDays } from "./logic";
export default function ProgramEditor({ onClose }: { onClose: () => void }) {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<Program>(() =>
      structuredClone(
        data.programs.find((p) => !p.archived) ?? data.programs[0],
      ),
    ),
    [selected, setSelected] = useState(0),
    [message, setMessage] = useState("");
  const day = draft.days[selected];
  const changeDay = (patch: Partial<Day>) =>
    setDraft({
      ...draft,
      days: draft.days.map((d, i) => (i === selected ? { ...d, ...patch } : d)),
    });
  const changeExercise = (id: string, patch: Partial<Exercise>) =>
    changeDay({
      exercises: day.exercises.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    });
  const save = () => {
    const copy = { ...draft, id: uid(), archived: false };
    update((d) => ({
      ...d,
      programs: [...d.programs.map((p) => ({ ...p, archived: true })), copy],
    }));
    setDraft(copy);
    setMessage(
      "Saved as a new active version. Previous versions and every workout log are preserved.",
    );
  };
  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        <ArrowLeft size={16} /> Back to workouts
      </Button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE IT YOURS</div>
          <h1>Program studio</h1>
          <p>
            Edit your next exposures. Saved sessions always keep their original
            prescriptions.
          </p>
        </div>
        <Button disabled={!draft.name.trim()} onClick={save}>
          Save new version
        </Button>
      </div>
      {message && (
        <div className="callout" role="status">
          {message}
        </div>
      )}
      <Card>
        <div className="form-grid">
          <Field label="Load program version">
            <select
              value={draft.id}
              onChange={(e) => {
                setDraft(
                  structuredClone(
                    data.programs.find((p) => p.id === e.target.value)!,
                  ),
                );
                setSelected(0);
                setMessage("");
              }}
            >
              {data.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.archived ? " · archived" : " · active"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Program name">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={draft.start}
              onChange={(e) =>
                e.target.value && setDraft({ ...draft, start: e.target.value })
              }
            />
          </Field>
        </div>
        <div className="row wrap">
          <Button
            variant="secondary"
            onClick={() => {
              setDraft({
                ...draft,
                name: "Next month · " + draft.name,
                start: addDays(draft.start, 28),
              });
              setMessage(
                "Next-month draft ready. Review completed sessions and accept progression suggestions before starting. Save a new version when ready.",
              );
            }}
          >
            <Copy size={16} /> Create next four weeks
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              update((d) => ({
                ...d,
                programs: d.programs.map((p) =>
                  p.id === draft.id ? { ...p, archived: true } : p,
                ),
              }));
              setMessage(
                "Program archived. Select a version and save it to activate a new copy.",
              );
            }}
          >
            Archive this version
          </Button>
        </div>
      </Card>
      <div className="chips">
        {draft.days.map((d, i) => (
          <button
            key={d.id}
            className={selected === i ? "active" : ""}
            onClick={() => setSelected(i)}
          >
            {d.name}
          </button>
        ))}
      </div>
      {day && (
        <>
          <Card>
            <div className="form-grid">
              <Field label="Workout name">
                <input
                  value={day.name}
                  onChange={(e) => changeDay({ name: e.target.value })}
                />
              </Field>
              <Field label="Day">
                <select
                  value={day.weekday}
                  onChange={(e) => changeDay({ weekday: +e.target.value })}
                >
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map((d, i) => (
                    <option value={i} key={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select
                  value={day.kind}
                  onChange={(e) =>
                    changeDay({ kind: e.target.value as Day["kind"] })
                  }
                >
                  {["strength", "run", "ruck", "recovery"].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Workout instructions">
              <textarea
                value={day.notes}
                onChange={(e) => changeDay({ notes: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              {day.endurance.map((v, i) => (
                <Field label={`Week ${i + 1} endurance instructions`} key={i}>
                  <input
                    value={v}
                    onChange={(e) =>
                      changeDay({
                        endurance: day.endurance.map((s, j) =>
                          j === i ? e.target.value : s,
                        ),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="row wrap">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft({
                    ...draft,
                    days: [
                      ...draft.days,
                      {
                        ...structuredClone(day),
                        id: uid(),
                        name: day.name + " copy",
                      },
                    ],
                  });
                  setSelected(draft.days.length);
                }}
              >
                <Copy size={16} /> Duplicate workout
              </Button>
              <Button
                variant="danger"
                disabled={draft.days.length === 1}
                onClick={() => {
                  if (confirmDelete("this workout from the draft")) {
                    setDraft({
                      ...draft,
                      days: draft.days.filter((_, i) => i !== selected),
                    });
                    setSelected(0);
                  }
                }}
              >
                Remove workout
              </Button>
            </div>
          </Card>
          {day.exercises.map((e, index) => (
            <Card key={e.id}>
              <div className="row between">
                <h3>Exercise {index + 1}</h3>
                <div className="row">
                  <Button
                    variant="icon"
                    aria-label="Move exercise up"
                    disabled={!index}
                    onClick={() => {
                      const list = [...day.exercises];
                      [list[index - 1], list[index]] = [
                        list[index],
                        list[index - 1],
                      ];
                      changeDay({ exercises: list });
                    }}
                  >
                    <ChevronUp size={18} />
                  </Button>
                  <Button
                    variant="icon"
                    aria-label={`Remove ${e.name}`}
                    onClick={() =>
                      confirmDelete(e.name + " from the draft") &&
                      changeDay({
                        exercises: day.exercises.filter((x) => x.id !== e.id),
                      })
                    }
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Exercise name (rename replaces exercise history link)">
                  <input
                    value={e.name}
                    onChange={(ev) =>
                      changeExercise(e.id, { name: ev.target.value })
                    }
                    onBlur={() => {
                      const id = e.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-");
                      if (
                        id &&
                        !day.exercises.some((x) => x.id === id && x !== e)
                      )
                        changeExercise(e.id, { id });
                    }}
                  />
                </Field>
                <Field label="Equipment">
                  <input
                    value={e.equipment}
                    onChange={(ev) =>
                      changeExercise(e.id, { equipment: ev.target.value })
                    }
                  />
                </Field>
                <Field label="Progression category">
                  <select
                    value={e.group}
                    onChange={(ev) =>
                      changeExercise(e.id, {
                        group: ev.target.value as Exercise["group"],
                      })
                    }
                  >
                    {["upper", "lower", "core", "carry"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Repetition unit">
                  <select
                    value={e.unit}
                    onChange={(ev) =>
                      changeExercise(e.id, {
                        unit: ev.target.value as Exercise["unit"],
                      })
                    }
                  >
                    <option value="reps">Repetitions</option>
                    <option value="m">Meters</option>
                  </select>
                </Field>
              </div>
              <Field label="Technique notes">
                <input
                  value={e.notes}
                  onChange={(ev) =>
                    changeExercise(e.id, { notes: ev.target.value })
                  }
                />
              </Field>
              <div className="plan-grid plan-header">
                <span>Week</span>
                <span>Sets</span>
                <span>Reps / range</span>
                <span>RPE</span>
                <span>Rest sec</span>
              </div>
              {e.weeks.map((w, i) => (
                <div className="plan-grid" key={i}>
                  <strong>W{i + 1}</strong>
                  <NumberInput
                    aria-label={`Week ${i + 1} sets`}
                    value={w.sets}
                    step={1}
                    max={30}
                    onChange={(v) =>
                      changeExercise(e.id, {
                        weeks: e.weeks.map((x, j) =>
                          j === i ? { ...x, sets: Math.floor(v ?? 0) } : x,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`Week ${i + 1} reps`}
                    value={w.reps}
                    onChange={(ev) =>
                      changeExercise(e.id, {
                        weeks: e.weeks.map((x, j) =>
                          j === i ? { ...x, reps: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                  <NumberInput
                    aria-label={`Week ${i + 1} RPE`}
                    value={w.rpe}
                    max={10}
                    onChange={(v) =>
                      changeExercise(e.id, {
                        weeks: e.weeks.map((x, j) =>
                          j === i ? { ...x, rpe: v ?? 0 } : x,
                        ),
                      })
                    }
                  />
                  <NumberInput
                    aria-label={`Week ${i + 1} rest seconds`}
                    value={w.rest}
                    max={3600}
                    onChange={(v) =>
                      changeExercise(e.id, {
                        weeks: e.weeks.map((x, j) =>
                          j === i ? { ...x, rest: v ?? 0 } : x,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </Card>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              changeDay({
                exercises: [
                  ...day.exercises,
                  {
                    id: uid(),
                    name: "New exercise",
                    group: "upper",
                    equipment: "Dumbbells",
                    notes: "",
                    unit: "reps",
                    weeks: Array.from({ length: 4 }, (_, i) => ({
                      sets: i === 3 ? 2 : 3,
                      reps: "8–10",
                      rpe: i === 3 ? 6 : 7,
                      rest: 90,
                    })),
                  },
                ],
              })
            }
          >
            <Plus size={16} /> Add exercise
          </Button>
        </>
      )}
    </>
  );
}
