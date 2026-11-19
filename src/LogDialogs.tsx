import { useState } from "react";
import { useStore } from "./store";
import { Button, Field, NumberInput, Modal, confirmDelete } from "./components";
import { Endurance, Measurement, uid } from "./model";
import { clock, pace } from "./logic";
export const newEndurance = (
  date: string,
  kind: Endurance["kind"],
): Endurance => ({
  id: uid(),
  date,
  kind,
  distance: 0,
  minutes: 0,
  rpe: 5,
  dryWeight: kind === "ruck" ? 45 : 0,
  extraWeight: 0,
  elevation: 0,
  terrain: "",
  symptoms: "",
  notes: "",
});
export const newMeasurement = (date: string): Measurement => ({
  id: uid(),
  date,
  weight: null,
  waist: null,
  bodyFat: null,
  pullups: null,
  sleep: null,
  fatigue: null,
  soreness: null,
  notes: "",
  photo: "",
});
export function EnduranceDialog({
  initial,
  onClose,
}: {
  initial: Endurance;
  onClose: () => void;
}) {
  const { data, update } = useStore(),
    [draft, setDraft] = useState(initial);
  const set = (patch: Partial<Endurance>) => setDraft({ ...draft, ...patch });
  return (
    <Modal title="Endurance log" open onClose={onClose}>
      <div className="form-grid">
        <Field label="Activity">
          <select
            value={draft.kind}
            onChange={(e) => set({ kind: e.target.value as Endurance["kind"] })}
          >
            <option value="run">Outdoor run</option>
            <option value="ruck">Ruck</option>
            <option value="row">Rowing</option>
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
          />
        </Field>
        <Field label="Distance (miles)">
          <NumberInput
            value={draft.distance}
            onChange={(v) => set({ distance: v ?? 0 })}
          />
        </Field>
        <Field label="Total time (minutes, decimal allowed)">
          <NumberInput
            value={draft.minutes}
            onChange={(v) => set({ minutes: v ?? 0 })}
          />
        </Field>
        <Field label="Session RPE (0–10)">
          <NumberInput
            value={draft.rpe}
            max={10}
            onChange={(v) => set({ rpe: v ?? 0 })}
          />
        </Field>
        <Field label="Elevation gain (feet)">
          <NumberInput
            value={draft.elevation}
            onChange={(v) => set({ elevation: v ?? 0 })}
          />
        </Field>
        {draft.kind === "ruck" && (
          <>
            <Field label="Dry ruck weight (lb)">
              <NumberInput
                value={draft.dryWeight}
                onChange={(v) => set({ dryWeight: v ?? 0 })}
              />
            </Field>
            <Field label="Additional water / equipment (lb)">
              <NumberInput
                value={draft.extraWeight}
                onChange={(v) => set({ extraWeight: v ?? 0 })}
              />
            </Field>
          </>
        )}
      </div>
      <div className="callout">
        Average pace: {clock(pace(draft.minutes, draft.distance))} /mi{" "}
        {draft.kind === "ruck" &&
          `· Total carried: ${draft.dryWeight + draft.extraWeight} lb`}
      </div>
      <Field label="Terrain">
        <input
          value={draft.terrain}
          onChange={(e) => set({ terrain: e.target.value })}
        />
      </Field>
      <Field label="Foot discomfort, blisters, pain or other symptoms">
        <input
          value={draft.symptoms}
          onChange={(e) => set({ symptoms: e.target.value })}
        />
      </Field>
      <Field label="Notes">
        <textarea
          value={draft.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>
      {draft.kind === "ruck" && (
        <p className="caption">
          45 lb dry only if medically cleared for unrestricted loaded marching.
          Progress tolerated distance and recovery before pace; do not run under
          load.
        </p>
      )}
      <div className="row">
        <Button
          disabled={
            draft.minutes <= 0 || (draft.kind !== "row" && draft.distance <= 0)
          }
          onClick={() => {
            update((d) => ({
              ...d,
              endurance: [
                ...d.endurance.filter((x) => x.id !== draft.id),
                draft,
              ],
            }));
            onClose();
          }}
        >
          Save activity
        </Button>
        {data.endurance.some((e) => e.id === draft.id) && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirmDelete("this activity")) {
                update((d) => ({
                  ...d,
                  endurance: d.endurance.filter((x) => x.id !== draft.id),
                }));
                onClose();
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </Modal>
  );
}
export function MeasurementDialog({
  initial,
  onClose,
}: {
  initial: Measurement;
  onClose: () => void;
}) {
  const { data, update } = useStore(),
    [draft, setDraft] = useState(initial),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const fields = [
    ["weight", "Body weight (lb)", undefined],
    ["waist", "Waist (inches)", undefined],
    ["bodyFat", "Body fat estimate (%)", 100],
    ["pullups", "Strict pull-up maximum", undefined],
    ["sleep", "Sleep (hours)", 24],
    ["fatigue", "Fatigue (0–10)", 10],
    ["soreness", "Soreness (0–10)", 10],
  ] as const;
  return (
    <Modal title="Body & recovery check-in" open onClose={onClose}>
      <Field label="Date">
        <input
          type="date"
          value={draft.date}
          onChange={(e) =>
            e.target.value && setDraft({ ...draft, date: e.target.value })
          }
        />
      </Field>
      <div className="form-grid">
        {fields.map(([key, label, max]) => (
          <Field key={key} label={label}>
            <NumberInput
              value={draft[key]}
              max={max}
              onChange={(v) => setDraft({ ...draft, [key]: v })}
            />
          </Field>
        ))}
      </div>
      <Field label="Notes">
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </Field>
      <Field label="Progress photo (local only, up to 8 MB)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (
              file.size > 8000000 ||
              !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ) {
              setError("Choose a JPEG, PNG or WebP image smaller than 8 MB.");
              return;
            }
            setLoading(true);
            const reader = new FileReader();
            reader.onload = () => {
              setDraft((d) => ({ ...d, photo: String(reader.result) }));
              setLoading(false);
              setError("");
            };
            reader.onerror = () => {
              setError("Unable to read image");
              setLoading(false);
            };
            reader.readAsDataURL(file);
          }}
        />
      </Field>
      {draft.photo && (
        <>
          <img
            className="photo-preview"
            src={draft.photo}
            alt="Selected progress photo"
          />
          <Button
            variant="ghost"
            onClick={() => setDraft({ ...draft, photo: "" })}
          >
            Remove photo
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="row">
        <Button
          disabled={loading}
          onClick={() => {
            update((d) => ({
              ...d,
              measurements: [
                ...d.measurements.filter((m) => m.id !== draft.id),
                draft,
              ],
            }));
            onClose();
          }}
        >
          Save check-in
        </Button>
        {data.measurements.some((m) => m.id === draft.id) && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirmDelete("this check-in")) {
                update((d) => ({
                  ...d,
                  measurements: d.measurements.filter((m) => m.id !== draft.id),
                }));
                onClose();
              }
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </Modal>
  );
}
