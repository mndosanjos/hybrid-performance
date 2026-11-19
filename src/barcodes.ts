import { Food, Macros } from "./model";

export function normalizeBarcode(input: string): string {
  const value = input.replace(/[\s-]/g, "");
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value))
    throw new Error("Enter an 8, 12, 13 or 14 digit product barcode.");
  let sum = 0;
  for (let i = value.length - 2, position = 0; i >= 0; i--, position++)
    sum += Number(value[i]) * (position % 2 === 0 ? 3 : 1);
  if ((10 - (sum % 10)) % 10 !== Number(value.at(-1)))
    throw new Error(
      "The barcode check digit does not match. Check the printed digits and try again.",
    );
  if (value.length === 12) return "0" + value;
  if (value.length === 14 && value.startsWith("0")) return value.slice(1);
  return value;
}
export function findBarcodeFood(foods: Food[], barcode: string) {
  const code = normalizeBarcode(barcode);
  return foods.find((f) => {
    if (!f.barcode) return false;
    try {
      return normalizeBarcode(f.barcode) === code;
    } catch {
      return false;
    }
  });
}
type NullableMacros = { [K in keyof Macros]: number | null };
export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand: string;
  basis: "100g" | "serving";
  servingGrams: number;
  servingDescription: string;
  macros: NullableMacros;
  source: "openfoodfacts" | "manual";
  warnings: string[];
}
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const label = (v: unknown) => (typeof v === "string" ? v.slice(0, 500) : "");
const number = (v: unknown): number | null => {
  if (
    (typeof v !== "number" && typeof v !== "string") ||
    (typeof v === "string" && !v.trim())
  )
    return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
export const blankBarcodeProduct = (barcode: string): BarcodeProduct => ({
  barcode: normalizeBarcode(barcode),
  name: "",
  brand: "",
  basis: "serving",
  servingGrams: 0,
  servingDescription: "1 serving",
  macros: { calories: null, protein: null, carbs: null, fat: null },
  source: "manual",
  warnings: [
    "Enter the nutrition from your package. Missing values are not assumed to be zero.",
  ],
});

// Never infer a liquid's gram weight from milliliters, or treat missing macros as zero.
export function parseOpenFoodFacts(
  payload: unknown,
  barcode: string,
): BarcodeProduct | null {
  const root = record(payload);
  if (root.status === 0) return null;
  const product = record(root.product);
  if (root.status !== 1 || !Object.keys(product).length)
    throw new Error(
      "The food database returned an unreadable product. Please enter the label manually.",
    );
  if (
    product.code &&
    normalizeBarcode(String(product.code)) !== normalizeBarcode(barcode)
  )
    throw new Error(
      "The returned product has a different barcode. Please enter the label manually.",
    );
  const nutrients = record(product.nutriments),
    warnings: string[] = [];
  const servingDescription = label(product.serving_size) || "1 serving";
  let servingGrams = 0;
  const gramMatch = servingDescription.match(
    /(?:^|[\s(])(\d+(?:[.,]\d+)?)\s*g(?:\b|\))/i,
  );
  const ozMatch = servingDescription.match(
    /(?:^|[\s(])(\d+(?:[.,]\d+)?)\s*oz\b/i,
  );
  if (gramMatch) servingGrams = Number(gramMatch[1].replace(",", "."));
  else if (ozMatch)
    servingGrams = Number(ozMatch[1].replace(",", ".")) * 28.349523125;
  else if (product.serving_quantity_unit === "g")
    servingGrams = number(product.serving_quantity) ?? 0;
  const liquid =
    String(product.nutrition_data_per ?? "").toLowerCase() === "100ml" ||
    (/\bml\b/i.test(servingDescription) && !servingGrams);
  const read = (suffix: string): NullableMacros => {
    let calories = number(nutrients["energy-kcal" + suffix]);
    const kj =
      number(nutrients["energy-kj" + suffix]) ??
      (nutrients.energy_unit === "kJ" || nutrients.energy_unit === undefined
        ? number(nutrients["energy" + suffix])
        : null);
    if (calories === null && kj !== null) calories = kj / 4.184;
    return {
      calories,
      protein: number(nutrients["proteins" + suffix]),
      carbs: number(nutrients["carbohydrates" + suffix]),
      fat: number(nutrients["fat" + suffix]),
    };
  };
  const per100 = read("_100g"),
    perServing = read("_serving");
  const has100 = Object.values(per100).some((v) => v !== null),
    hasServing = Object.values(perServing).some((v) => v !== null);
  const basis = liquid || (!has100 && hasServing) ? "serving" : "100g";
  const macros = basis === "100g" ? per100 : perServing;
  if (liquid)
    warnings.push(
      "Liquid product: use per-serving values from the label. Milliliters are not converted to grams.",
    );
  if (!servingGrams)
    warnings.push(
      basis === "100g"
        ? "Serving weight is unknown. You can log grams or ounces; enter a serving weight to log servings or items."
        : "Serving weight is unknown. Enter its gram weight to use grams or ounces.",
    );
  if (Object.values(macros).some((v) => v === null))
    warnings.push(
      "Some nutrition values are missing. Fill every field from the label before saving.",
    );
  return {
    barcode: normalizeBarcode(barcode),
    name: label(product.product_name) || label(product.product_name_en),
    brand: label(product.brands),
    basis,
    servingGrams,
    servingDescription,
    macros,
    source: "openfoodfacts",
    warnings,
  };
}

const fields =
  "code,product_name,product_name_en,brands,serving_size,serving_quantity,serving_quantity_unit,nutrition_data_per,nutriments";
export async function lookupBarcode(
  barcode: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<BarcodeProduct | null> {
  const code = normalizeBarcode(barcode),
    controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 12000);
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}&app_name=HybridPerformance&app_version=1.1.0`;
    const response = await fetcher(url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (response.status === 404) return null;
    if (response.status === 429)
      throw new Error(
        "The food database is busy or rate-limited. Wait a minute and retry, or enter the label manually.",
      );
    if (!response.ok)
      throw new Error(
        "The food database is unavailable right now. Retry later or enter the label manually.",
      );
    return parseOpenFoodFacts(await response.json(), code);
  } catch (e) {
    if (signal.aborted)
      throw new DOMException("Lookup cancelled", "AbortError");
    if (timedOut)
      throw new Error(
        "Product lookup timed out. Retry or enter the label manually.",
      );
    if (e instanceof TypeError)
      throw new Error(
        "Unable to reach the food database. Check your connection, or enter the label manually.",
      );
    throw e;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
