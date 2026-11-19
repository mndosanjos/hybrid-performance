import { useDraft } from "./drafts";
import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Star,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ScanBarcode,
} from "lucide-react";
import BarcodeDialog from "./BarcodeDialog";
import { findBarcodeFood } from "./barcodes";
import { useStore } from "./store";
import {
  Button,
  Card,
  Field,
  NumberInput,
  Modal,
  MacroBars,
  Empty,
  confirmDelete,
} from "./components";
import { Food, FoodLog, Macros, Recipe, uid } from "./model";
import {
  addDays,
  foodMacros,
  macroKeys,
  recipeMacros,
  totals,
  zero,
  weekday,
} from "./logic";
export const meals: FoodLog["meal"][] = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snacks",
  "Drinks",
];
export function goalsFor(
  data: ReturnType<typeof useStore>["data"],
  date: string,
) {
  const plan = data.programs.find((p) => !p.archived);
  const rest =
    plan?.days
      .filter((d) => d.weekday === weekday(date))
      .every((d) => d.kind === "recovery") ?? weekday(date) === 6;
  return data.profile.useRestGoals && rest
    ? data.profile.restGoals
    : data.profile.trainingGoals;
}
function MacroFields({
  value,
  onChange,
}: {
  value: Macros;
  onChange: (m: Macros) => void;
}) {
  return (
    <div className="form-grid">
      {macroKeys.map((k) => (
        <Field
          key={k}
          label={k === "calories" ? "Calories (kcal)" : `${k} (g)`}
        >
          <NumberInput
            value={value[k]}
            onChange={(v) => onChange({ ...value, [k]: v ?? 0 })}
          />
        </Field>
      ))}
    </div>
  );
}
export default function Nutrition({
  date,
  setDate,
  quickOpen = false,
  onQuickHandled,
}: {
  date: string;
  setDate: (d: string) => void;
  quickOpen?: boolean;
  onQuickHandled: () => void;
}) {
  const { data, update } = useStore();
  const [open, setOpen] = useState(quickOpen),
    [scannerOpen, setScannerOpen] = useState(false),
    [meal, setMeal] = useState<FoodLog["meal"]>("Breakfast"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<Food | null>(null),
    [quantity, setQuantity] = useState<number | null>(100),
    [unit, setUnit] = useState("g"),
    [foodDraft, setFoodDraft] = useDraft<Food | null>("nutrition-food", null),
    [editLog, setEditLog] = useDraft<FoodLog | null>("nutrition-entry", null),
    [recipe, setRecipe] = useDraft<Recipe | null>("nutrition-recipe", null),
    [recipeFood, setRecipeFood] = useState(""),
    [ingredientGrams, setIngredientGrams] = useState<number | null>(100),
    [portionRecipe, setPortionRecipe] = useState<Recipe | null>(null),
    [portion, setPortion] = useState<number | null>(1),
    [portionUnit, setPortionUnit] = useState<"g" | "serving">("serving"),
    [copyFrom, setCopyFrom] = useState(addDays(date, -1)),
    [error, setError] = useState("");
  const lastPositivePortion = useRef<FoodLog | null>(null);
  if (editLog && editLog.quantity > 0) lastPositivePortion.current = editLog;
  const logs = data.foodLogs.filter((f) => f.date === date),
    consumed = totals(logs.map((l) => l.macros)),
    goal = goalsFor(data, date),
    last7 = data.foodLogs.filter(
      (l) => l.date >= addDays(date, -6) && l.date <= date,
    ),
    avg = totals(last7.map((l) => l.macros));
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    data.foodLogs.forEach((l) =>
      map.set(l.foodId, (map.get(l.foodId) ?? 0) + 1),
    );
    return map;
  }, [data.foodLogs]);
  const foods = data.foods
    .filter((f) =>
      `${f.name} ${f.brand}`.toLowerCase().includes(query.toLowerCase()),
    )
    .filter((f) =>
      filter === "favorites"
        ? f.favorite
        : filter === "recent" || filter === "frequent"
          ? counts.has(f.id)
          : true,
    )
    .sort((a, b) =>
      filter === "frequent"
        ? (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
        : filter === "recent"
          ? Math.max(
              0,
              ...data.foodLogs
                .filter((l) => l.foodId === b.id)
                .map((l) => Date.parse(l.date) + (l.createdAt ?? 0) / 1e8),
            ) -
            Math.max(
              0,
              ...data.foodLogs
                .filter((l) => l.foodId === a.id)
                .map((l) => Date.parse(l.date) + (l.createdAt ?? 0) / 1e8),
            )
          : a.name.localeCompare(b.name),
    );
  const addLog = (
    name: string,
    macros: Macros,
    foodId = "",
    q = 1,
    u: FoodLog["unit"] = "manual",
  ) =>
    update((d) => ({
      ...d,
      foodLogs: [
        ...d.foodLogs,
        {
          id: uid(),
          date,
          meal,
          name,
          foodId,
          quantity: q,
          unit: u,
          macros,
          createdAt: Date.now(),
        },
      ],
    }));
  const choose = (f: Food) => {
    setSelected(f);
    setQuantity(f.basis === "100g" ? 100 : 1);
    setUnit(f.basis === "100g" ? "g" : "serving");
    setError("");
  };
  const newFood = () =>
    setFoodDraft({
      id: uid(),
      name: "",
      brand: "",
      basis: "serving",
      servingGrams: 0,
      servingDescription: "1 serving",
      macros: zero(),
      estimate: false,
      favorite: false,
    });
  const copyMeal = () => {
    const source = data.foodLogs.filter(
      (l) => l.date === copyFrom && l.meal === meal,
    );
    if (!source.length) {
      setError("No entries in that meal on the selected day.");
      return;
    }
    update((d) => ({
      ...d,
      foodLogs: [
        ...d.foodLogs,
        ...source.map((l) => ({
          ...l,
          id: uid(),
          date,
          createdAt: Date.now(),
        })),
      ],
    }));
    setError("");
    setOpen(false);
  };
  const recipeTotal = recipe
    ? totals(recipe.ingredients.map((i) => i.macros))
    : zero();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Food diary</h1>
          <p>Meals, calories and macros.</p>
        </div>
        <div className="row wrap nutrition-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
              setScannerOpen(true);
            }}
          >
            <ScanBarcode size={18} /> Scan barcode
          </Button>
          <Button
            onClick={() => {
              setOpen(true);
              onQuickHandled();
            }}
          >
            <Plus size={18} /> Log food
          </Button>
        </div>
      </div>
      <div className="row between wrap date-nav">
        <div className="row">
          <Button
            variant="icon"
            aria-label="Previous day"
            onClick={() => setDate(addDays(date, -1))}
          >
            <ChevronLeft size={20} />
          </Button>
          <input
            type="date"
            aria-label="Nutrition date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button
            variant="icon"
            aria-label="Next day"
            onClick={() => setDate(addDays(date, 1))}
          >
            <ChevronRight size={20} />
          </Button>
        </div>
        {data.profile.useRestGoals && (
          <span className="pill">Day-specific targets</span>
        )}
      </div>
      <Card className="nutrition-overview">
        <div className="calorie-summary">
          <h2>Calories</h2>
          <div className="calorie-equation">
            <div>
              <strong>{goal.calories.toLocaleString()}</strong>
              <span>Goal</span>
            </div>
            <span aria-hidden="true">−</span>
            <div>
              <strong>{Math.round(consumed.calories).toLocaleString()}</strong>
              <span>Food</span>
            </div>
            <span aria-hidden="true">=</span>
            <div
              className={
                consumed.calories > goal.calories ? "overage" : "remaining"
              }
            >
              <strong>
                {Math.abs(
                  Math.round(goal.calories - consumed.calories),
                ).toLocaleString()}
              </strong>
              <span>
                {consumed.calories > goal.calories ? "Over goal" : "Remaining"}
              </span>
            </div>
          </div>
        </div>
        <MacroBars consumed={consumed} goals={goal} />
      </Card>
      <div className="nutrition-layout">
        <div>
          {meals.map((m) => {
            const entries = logs.filter((l) => l.meal === m),
              t = totals(entries.map((l) => l.macros));
            return (
              <Card key={m} className="meal-card">
                <div className="row between">
                  <h3>{m}</h3>
                  <div className="row">
                    <span className="muted">{Math.round(t.calories)} kcal</span>
                    <Button
                      variant="icon"
                      aria-label={`Add food to ${m}`}
                      onClick={() => {
                        setMeal(m);
                        setOpen(true);
                      }}
                    >
                      <Plus size={19} />
                    </Button>
                  </div>
                </div>
                {entries.length ? (
                  entries.map((l) => (
                    <div className="food-log-row" key={l.id}>
                      <button
                        onClick={() =>
                          setEditLog({ ...l, macros: { ...l.macros } })
                        }
                      >
                        <strong>{l.name}</strong>
                        <small>
                          {l.quantity} {l.unit} · P{" "}
                          {l.macros.protein.toFixed(1)} / C{" "}
                          {l.macros.carbs.toFixed(1)} / F{" "}
                          {l.macros.fat.toFixed(1)}
                        </small>
                      </button>
                      <span>{Math.round(l.macros.calories)}</span>
                      <Button
                        variant="icon"
                        aria-label={`Duplicate ${l.name}`}
                        onClick={() =>
                          update((d) => ({
                            ...d,
                            foodLogs: [
                              ...d.foodLogs,
                              { ...l, id: uid(), createdAt: Date.now() },
                            ],
                          }))
                        }
                      >
                        <Copy size={15} />
                      </Button>
                      <Button
                        variant="icon"
                        aria-label={`Delete ${l.name}`}
                        onClick={() =>
                          confirmDelete(l.name) &&
                          update((d) => ({
                            ...d,
                            foodLogs: d.foodLogs.filter((x) => x.id !== l.id),
                          }))
                        }
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="muted">No foods logged</p>
                )}
                <Button
                  variant="ghost"
                  className="meal-add"
                  onClick={() => {
                    setMeal(m);
                    setOpen(true);
                  }}
                >
                  <Plus size={16} /> Add food
                </Button>
                {entries.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setRecipe({
                        id: uid(),
                        name: `${m} template`,
                        servings: 1,
                        finishedGrams: 0,
                        template: true,
                        ingredients: entries.map((l) => ({
                          id: uid(),
                          name: l.name,
                          grams: 0,
                          macros: { ...l.macros },
                        })),
                      })
                    }
                  >
                    Save as meal template
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
        <div>
          <Card>
            <div className="eyebrow">LAST 7 DAYS</div>
            <h3>Daily averages</h3>
            <div className="stat-pair">
              <div>
                <strong>{Math.round(avg.calories / 7)}</strong>
                <small>kcal / day</small>
              </div>
              <div>
                <strong>{Math.round(avg.protein / 7)} g</strong>
                <small>protein / day</small>
              </div>
            </div>
            <p>
              {new Set(last7.map((l) => l.date)).size} of 7 days logged.
              Averages include unlogged days as zero.
            </p>
          </Card>
          <Card>
            <div className="row between">
              <h3>Recipes & saved meals</h3>
              <Button
                variant="icon"
                aria-label="Create recipe"
                onClick={() =>
                  setRecipe({
                    id: uid(),
                    name: "",
                    servings: 1,
                    finishedGrams: 0,
                    ingredients: [],
                    template: false,
                  })
                }
              >
                <Plus size={18} />
              </Button>
            </div>
            {data.recipes.length ? (
              data.recipes.map((r) => (
                <div className="recipe-row" key={r.id}>
                  <button
                    onClick={() => {
                      setPortionRecipe(r);
                      setPortion(1);
                      setPortionUnit("serving");
                    }}
                  >
                    <strong>{r.name}</strong>
                    <small>
                      {r.servings} servings ·{" "}
                      {Math.round(
                        totals(r.ingredients.map((i) => i.macros)).calories /
                          r.servings,
                      )}{" "}
                      kcal / serving
                    </small>
                  </button>
                  <Button
                    variant="ghost"
                    onClick={() => setRecipe(structuredClone(r))}
                  >
                    Edit
                  </Button>
                </div>
              ))
            ) : (
              <Empty
                title="No saved recipes"
                detail="Add ingredients to create a reusable recipe."
              />
            )}
            <Button variant="secondary" onClick={newFood}>
              Create custom food
            </Button>
          </Card>
          <p className="caption">
            Starter food values are editable generic estimates. Cooking methods
            and brands vary; use your label for exact values.
          </p>
        </div>
      </div>
      <Modal
        title={`Log food · ${date}`}
        open={open}
        onClose={() => {
          setOpen(false);
          onQuickHandled();
        }}
      >
        <Field label="Meal">
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as FoodLog["meal"])}
          >
            {meals.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setScannerOpen(true);
          }}
        >
          <ScanBarcode size={18} /> Scan barcode
        </Button>
        <div className="search-box">
          <Search size={18} />
          <input
            aria-label="Search saved foods"
            placeholder="Search foods or brands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="chips">
          {["all", "recent", "frequent", "favorites"].map((f) => (
            <button
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
              key={f}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="food-picker">
          {foods.map((f) => (
            <div className="food-picker-row" key={f.id}>
              <button onClick={() => choose(f)}>
                <strong>{f.name}</strong>
                <small>
                  {f.estimate ? "Generic estimate" : f.brand || "Custom food"} ·{" "}
                  {f.macros.calories} kcal /{" "}
                  {f.basis === "100g" ? "100 g" : f.servingDescription}
                </small>
              </button>
              <Button
                variant="icon"
                aria-label={`Favorite ${f.name}`}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    foods: d.foods.map((x) =>
                      x.id === f.id ? { ...x, favorite: !x.favorite } : x,
                    ),
                  }))
                }
              >
                <Star size={17} fill={f.favorite ? "currentColor" : "none"} />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setFoodDraft(structuredClone(f))}
              >
                Edit
              </Button>
            </div>
          ))}
          {!foods.length && <p>No matching foods. Create one below.</p>}
        </div>
        <div className="row wrap">
          <Button variant="secondary" onClick={newFood}>
            + Custom food
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setEditLog({
                id: uid(),
                date,
                meal,
                name: "Quick add",
                foodId: "",
                quantity: 1,
                unit: "manual",
                macros: zero(),
              })
            }
          >
            Quick-add macros
          </Button>
        </div>
        <hr />
        <div className="row wrap">
          <Field label={`Copy ${meal} from`}>
            <input
              type="date"
              value={copyFrom}
              onChange={(e) => e.target.value && setCopyFrom(e.target.value)}
            />
          </Field>
          <Button variant="secondary" onClick={copyMeal}>
            <Copy size={16} /> Copy meal
          </Button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </Modal>
      <Modal
        title={selected?.name ?? "Food quantity"}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <Field label="Meal for scanned or selected food">
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value as FoodLog["meal"])}
              >
                {meals.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <p>
              {selected.estimate ? "Generic estimate · " : ""}
              {selected.servingDescription} ={" "}
              {selected.servingGrams || "unknown"} g
            </p>
            {selected.barcode && (
              <p className="caption">
                Saved barcode: {selected.barcode}
                {selected.source === "openfoodfacts" && (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={`https://world.openfoodfacts.org/product/${selected.barcode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Food Facts · ODbL
                    </a>
                  </>
                )}
              </p>
            )}
            <div className="form-grid">
              <Field label="Quantity">
                <NumberInput value={quantity} onChange={setQuantity} />
              </Field>
              <Field label="Unit">
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option
                    value="g"
                    disabled={
                      selected.basis === "serving" && !selected.servingGrams
                    }
                  >
                    grams (preferred)
                  </option>
                  <option
                    value="oz"
                    disabled={
                      selected.basis === "serving" && !selected.servingGrams
                    }
                  >
                    ounces
                  </option>
                  <option
                    value="serving"
                    disabled={
                      selected.basis === "100g" && !selected.servingGrams
                    }
                  >
                    servings
                  </option>
                  <option
                    value="item"
                    disabled={
                      selected.basis === "100g" && !selected.servingGrams
                    }
                  >
                    items
                  </option>
                </select>
              </Field>
            </div>
            {error && <p className="error">{error}</p>}
            <Button
              disabled={!quantity || quantity <= 0}
              onClick={() => {
                try {
                  addLog(
                    selected.name,
                    foodMacros(selected, quantity!, unit),
                    selected.id,
                    quantity!,
                    unit as FoodLog["unit"],
                  );
                  setSelected(null);
                  setOpen(false);
                  onQuickHandled();
                  setError("");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Add to {meal}
            </Button>
          </>
        )}
      </Modal>
      <Modal
        title="Custom food / label"
        open={!!foodDraft}
        onClose={() => setFoodDraft(null)}
      >
        {foodDraft && (
          <>
            <Field label="Food name">
              <input
                value={foodDraft.name}
                onChange={(e) =>
                  setFoodDraft({ ...foodDraft, name: e.target.value })
                }
              />
            </Field>
            <Field label="Brand (optional)">
              <input
                value={foodDraft.brand}
                onChange={(e) =>
                  setFoodDraft({ ...foodDraft, brand: e.target.value })
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="Nutrition basis">
                <select
                  value={foodDraft.basis}
                  onChange={(e) =>
                    setFoodDraft({
                      ...foodDraft,
                      basis: e.target.value as Food["basis"],
                    })
                  }
                >
                  <option value="serving">Per serving</option>
                  <option value="100g">Per 100 grams</option>
                </select>
              </Field>
              <Field label="One serving weighs (g)">
                <NumberInput
                  value={foodDraft.servingGrams}
                  onChange={(v) =>
                    setFoodDraft({ ...foodDraft, servingGrams: v ?? 0 })
                  }
                />
              </Field>
            </div>
            <Field label="Serving description">
              <input
                value={foodDraft.servingDescription}
                onChange={(e) =>
                  setFoodDraft({
                    ...foodDraft,
                    servingDescription: e.target.value,
                  })
                }
              />
            </Field>
            <MacroFields
              value={foodDraft.macros}
              onChange={(macros) => setFoodDraft({ ...foodDraft, macros })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={foodDraft.estimate}
                onChange={(e) =>
                  setFoodDraft({ ...foodDraft, estimate: e.target.checked })
                }
              />{" "}
              Values are generic estimates
            </label>
            <p className="caption">
              Enter the values from your label. Existing food logs keep the
              nutrition recorded at the time.
            </p>
            <div className="row wrap">
              <Button
                disabled={!foodDraft.name.trim()}
                onClick={() => {
                  update((d) => ({
                    ...d,
                    foods: [
                      ...d.foods.filter((f) => f.id !== foodDraft.id),
                      foodDraft,
                    ],
                  }));
                  setFoodDraft(null);
                }}
              >
                Save food
              </Button>
              {data.foods.some((f) => f.id === foodDraft.id) && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirmDelete(foodDraft.name)) {
                      update((d) => ({
                        ...d,
                        foods: d.foods.filter((f) => f.id !== foodDraft.id),
                      }));
                      setFoodDraft(null);
                    }
                  }}
                >
                  Delete saved food
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
      <Modal
        title="Edit food entry / quick add"
        open={!!editLog}
        onClose={() => setEditLog(null)}
      >
        {editLog && (
          <>
            <Field label="Food name">
              <input
                value={editLog.name}
                onChange={(e) =>
                  setEditLog({ ...editLog, name: e.target.value })
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="Date">
                <input
                  type="date"
                  value={editLog.date}
                  onChange={(e) =>
                    e.target.value &&
                    setEditLog({ ...editLog, date: e.target.value })
                  }
                />
              </Field>
              <Field label="Meal">
                <select
                  value={editLog.meal}
                  onChange={(e) =>
                    setEditLog({
                      ...editLog,
                      meal: e.target.value as FoodLog["meal"],
                    })
                  }
                >
                  {meals.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label={`Quantity (${editLog.unit})`}>
                <NumberInput
                  value={editLog.quantity}
                  onChange={(v) => {
                    const q = v ?? 0;
                    const base =
                      lastPositivePortion.current?.id === editLog.id
                        ? lastPositivePortion.current
                        : data.foodLogs.find((l) => l.id === editLog.id);
                    setEditLog({
                      ...editLog,
                      quantity: q,
                      macros:
                        q > 0 && base && base.quantity > 0
                          ? (Object.fromEntries(
                              macroKeys.map((k) => [
                                k,
                                (base.macros[k] * q) / base.quantity,
                              ]),
                            ) as Macros)
                          : editLog.macros,
                    });
                  }}
                />
              </Field>
            </div>
            <p>
              Nutrition below is for this entire entry. Quantity changes scale
              these recorded values.
            </p>
            <MacroFields
              value={editLog.macros}
              onChange={(macros) => setEditLog({ ...editLog, macros })}
            />
            <Button
              disabled={!editLog.name.trim() || editLog.quantity <= 0}
              onClick={() => {
                update((d) => ({
                  ...d,
                  foodLogs: [
                    ...d.foodLogs.filter((l) => l.id !== editLog.id),
                    editLog,
                  ],
                }));
                setEditLog(null);
                setOpen(false);
                onQuickHandled();
              }}
            >
              Save entry
            </Button>
          </>
        )}
      </Modal>
      <Modal
        title={recipe?.template ? "Meal template" : "Recipe builder"}
        open={!!recipe}
        onClose={() => setRecipe(null)}
      >
        {recipe && (
          <>
            <Field label="Recipe name">
              <input
                value={recipe.name}
                onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Number of servings">
                <NumberInput
                  min={0.01}
                  value={recipe.servings}
                  onChange={(v) => setRecipe({ ...recipe, servings: v ?? 1 })}
                />
              </Field>
              <Field label="Finished recipe weight (g, optional)">
                <NumberInput
                  value={recipe.finishedGrams}
                  onChange={(v) =>
                    setRecipe({ ...recipe, finishedGrams: v ?? 0 })
                  }
                />
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Ingredient">
                <select
                  value={recipeFood}
                  onChange={(e) => setRecipeFood(e.target.value)}
                >
                  <option value="">Choose a saved food</option>
                  {data.foods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ingredient amount (g)">
                <NumberInput
                  value={ingredientGrams}
                  onChange={setIngredientGrams}
                />
              </Field>
            </div>
            <Button
              variant="secondary"
              disabled={!recipeFood || !ingredientGrams}
              onClick={() => {
                try {
                  const f = data.foods.find((f) => f.id === recipeFood)!;
                  setRecipe({
                    ...recipe,
                    ingredients: [
                      ...recipe.ingredients,
                      {
                        id: uid(),
                        name: f.name,
                        grams: ingredientGrams!,
                        macros: foodMacros(f, ingredientGrams!, "g"),
                      },
                    ],
                  });
                  setError("");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Add ingredient
            </Button>
            {recipe.ingredients.map((i) => (
              <div className="recipe-row" key={i.id}>
                <div>
                  {i.name}
                  <small>
                    {i.grams ? `${i.grams} g · ` : ""}
                    {Math.round(i.macros.calories)} kcal
                  </small>
                </div>
                <Button
                  variant="icon"
                  aria-label={`Remove ${i.name}`}
                  onClick={() =>
                    setRecipe({
                      ...recipe,
                      ingredients: recipe.ingredients.filter(
                        (x) => x.id !== i.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            <p>
              Total: {Math.round(recipeTotal.calories)} kcal · P{" "}
              {recipeTotal.protein.toFixed(1)} / C{" "}
              {recipeTotal.carbs.toFixed(1)} / F {recipeTotal.fat.toFixed(1)}
            </p>
            <p>
              Per serving: {Math.round(recipeTotal.calories / recipe.servings)}{" "}
              kcal. Ingredient amounts use edible weights; match cooked or raw
              foods consistently.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="row">
              <Button
                disabled={
                  !recipe.name.trim() ||
                  !recipe.ingredients.length ||
                  recipe.servings <= 0
                }
                onClick={() => {
                  update((d) => ({
                    ...d,
                    recipes: [
                      ...d.recipes.filter((r) => r.id !== recipe.id),
                      recipe,
                    ],
                  }));
                  setRecipe(null);
                }}
              >
                Save recipe
              </Button>
              {data.recipes.some((r) => r.id === recipe.id) && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirmDelete(recipe.name)) {
                      update((d) => ({
                        ...d,
                        recipes: d.recipes.filter((r) => r.id !== recipe.id),
                      }));
                      setRecipe(null);
                    }
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
      <Modal
        title={portionRecipe?.name ?? "Log recipe"}
        open={!!portionRecipe}
        onClose={() => setPortionRecipe(null)}
      >
        {portionRecipe && (
          <>
            <Field label="Meal">
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value as FoodLog["meal"])}
              >
                {meals.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Portion">
                <NumberInput value={portion} onChange={setPortion} />
              </Field>
              <Field label="Unit">
                <select
                  value={portionUnit}
                  onChange={(e) =>
                    setPortionUnit(e.target.value as "g" | "serving")
                  }
                >
                  <option value="serving">servings</option>
                  <option value="g" disabled={!portionRecipe.finishedGrams}>
                    grams
                  </option>
                </select>
              </Field>
            </div>
            <Button
              disabled={!portion || portion <= 0}
              onClick={() => {
                addLog(
                  portionRecipe.name,
                  recipeMacros(portionRecipe, portion!, portionUnit),
                  portionRecipe.id,
                  portion!,
                  portionUnit,
                );
                setPortionRecipe(null);
              }}
            >
              Log portion
            </Button>
          </>
        )}
      </Modal>
      {scannerOpen && (
        <BarcodeDialog
          foods={data.foods}
          onClose={() => setScannerOpen(false)}
          onChoose={(f) => {
            setScannerOpen(false);
            choose(f);
          }}
          onSave={(f) => {
            const existing = f.barcode
              ? findBarcodeFood(data.foods, f.barcode)
              : undefined;
            const saved = existing ?? f;
            if (!existing) update((d) => ({ ...d, foods: [...d.foods, f] }));
            setScannerOpen(false);
            choose(saved);
          }}
        />
      )}
    </>
  );
}
