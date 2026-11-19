import { z } from "zod";
const id = z.string().min(1).max(120),
  text = z.string().max(20000),
  num = z.number().finite().nonnegative(),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
      "Invalid calendar date",
    );
export const macrosSchema = z.object({
  calories: num,
  protein: num,
  carbs: num,
  fat: num,
});
export type Macros = z.infer<typeof macrosSchema>;
const prescription = z.object({
  sets: num.int().max(30),
  reps: text,
  rpe: num.max(10),
  rest: num.max(3600),
});
export const exerciseSchema = z.object({
  id,
  name: text,
  group: z.enum(["upper", "lower", "core", "carry"]),
  equipment: text,
  notes: text,
  unit: z.enum(["reps", "m"]),
  weeks: z.array(prescription).length(4),
});
const daySchema = z.object({
  id,
  name: text,
  weekday: num.int().max(6),
  kind: z.enum(["strength", "run", "ruck", "recovery"]),
  notes: text,
  exercises: z.array(exerciseSchema),
  endurance: z.array(text).length(4),
});
export const programSchema = z.object({
  id,
  name: text,
  start: date,
  archived: z.boolean(),
  days: z.array(daySchema),
});
const setSchema = z.object({
  id,
  weight: num.nullable(),
  reps: num.nullable(),
  rpe: num.max(10).nullable(),
  complete: z.boolean(),
  warmup: z.boolean(),
});
export const sessionSchema = z.object({
  id,
  date,
  createdAt: num.optional(),
  programId: id,
  dayId: id,
  name: text,
  kind: z.enum(["strength", "run", "ruck", "recovery"]).optional(),
  instructions: text.optional(),
  week: num.int().min(1).max(4),
  status: z.enum(["active", "complete"]),
  elapsed: num,
  runningSince: num.nullable(),
  notes: text,
  exercises: z.array(
    z.object({
      id,
      sourceId: id,
      name: text,
      group: exerciseSchema.shape.group,
      equipment: text,
      unit: exerciseSchema.shape.unit,
      target: prescription,
      technique: text,
      notes: text,
      pain: z.boolean(),
      form: z.boolean(),
      skipped: z.boolean(),
      decision: z.enum(["pending", "accepted", "rejected"]),
      suggestedWeight: num.nullable(),
      sets: z.array(setSchema),
    }),
  ),
});
export const foodSchema = z.object({
  id,
  name: text,
  brand: text,
  basis: z.enum(["100g", "serving"]),
  servingGrams: num,
  servingDescription: text,
  macros: macrosSchema,
  estimate: z.boolean(),
  favorite: z.boolean(),
  barcode: z
    .string()
    .regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/)
    .optional(),
  source: z.enum(["openfoodfacts", "manual"]).optional(),
});
export const foodLogSchema = z.object({
  id,
  date,
  createdAt: num.optional(),
  meal: z.enum(["Breakfast", "Lunch", "Dinner", "Snacks", "Drinks"]),
  foodId: text,
  name: text,
  quantity: num,
  unit: z.enum(["g", "oz", "serving", "item", "manual"]),
  macros: macrosSchema,
});
export const recipeSchema = z.object({
  id,
  name: text,
  servings: num.positive(),
  finishedGrams: num,
  ingredients: z.array(
    z.object({ id, name: text, grams: num, macros: macrosSchema }),
  ),
  template: z.boolean(),
});
export const enduranceSchema = z.object({
  id,
  date,
  kind: z.enum(["run", "ruck", "row"]),
  distance: num,
  minutes: num,
  rpe: num.max(10),
  dryWeight: num,
  extraWeight: num,
  elevation: num,
  terrain: text,
  symptoms: text,
  notes: text,
});
export const measurementSchema = z.object({
  id,
  date,
  weight: num.nullable(),
  waist: num.nullable(),
  bodyFat: num.max(100).nullable(),
  pullups: num.nullable(),
  sleep: num.max(24).nullable(),
  fatigue: num.max(10).nullable(),
  soreness: num.max(10).nullable(),
  notes: text,
  photo: z
    .string()
    .max(12000000)
    .refine((v) => v === "" || /^data:image\/(jpeg|png|webp);base64,/.test(v)),
});
export const profileSchema = z.object({
  name: text,
  age: num,
  sex: text,
  height: num,
  startingWeight: num,
  pullups: num,
  runPR: num,
  ruckMiles: num,
  ruckPace: num,
  ruckWeight: num,
  background: text,
  goals: text,
  equipment: text,
  upperIncrement: num.positive(),
  lowerIncrement: num.positive(),
  maxDumbbell: num,
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  trainingGoals: macrosSchema,
  restGoals: macrosSchema,
  useRestGoals: z.boolean(),
  cues: z.boolean(),
});
export const dataSchema = z.object({
  version: z.literal(1),
  profile: profileSchema,
  programs: z.array(programSchema),
  sessions: z.array(sessionSchema),
  foods: z.array(foodSchema),
  foodLogs: z.array(foodLogSchema),
  recipes: z.array(recipeSchema),
  endurance: z.array(enduranceSchema),
  measurements: z.array(measurementSchema),
});
export type Data = z.infer<typeof dataSchema>;
export type Profile = Data["profile"];
export type Program = z.infer<typeof programSchema>;
export type Day = Program["days"][number];
export type Exercise = z.infer<typeof exerciseSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type SessionExercise = Session["exercises"][number];
export type WorkSet = SessionExercise["sets"][number];
export type Food = z.infer<typeof foodSchema>;
export type FoodLog = z.infer<typeof foodLogSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Endurance = z.infer<typeof enduranceSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export const uid = () => crypto.randomUUID();
export const collections = [
  "programs",
  "sessions",
  "foods",
  "foodLogs",
  "recipes",
  "endurance",
  "measurements",
] as const;
