import { afterEach, describe, expect, it, vi } from "vitest";
import {
  blankBarcodeProduct,
  findBarcodeFood,
  lookupBarcode,
  normalizeBarcode,
  parseOpenFoodFacts,
} from "./barcodes";
import { seed } from "./seed";
import { foodMacros, validateBackup } from "./logic";

const code = "3017620422003";
const payload = (product: Record<string, unknown>) => ({
  status: 1,
  product: { code, ...product },
});
describe("product barcodes", () => {
  it("normalizes equivalent UPC and EAN codes", () => {
    expect(normalizeBarcode("737628064502")).toBe("0737628064502");
    expect(normalizeBarcode("00737628064502")).toBe("0737628064502");
    expect(normalizeBarcode(" 3017-620422003 ")).toBe(code);
    expect(normalizeBarcode("96385074")).toBe("96385074");
  });
  it("rejects a bad length, URL and invalid check digit", () => {
    for (const v of [
      "123",
      "https://example.com",
      "3017620422004",
      "301762042200x",
    ])
      expect(() => normalizeBarcode(v)).toThrow();
  });
  it("finds a saved UPC when the camera reports EAN-13", () => {
    const f = { ...seed().foods[0], barcode: "737628064502" };
    expect(findBarcodeFood([f], "0737628064502")).toBe(f);
    expect(
      findBarcodeFood([{ ...f, barcode: undefined }], code),
    ).toBeUndefined();
  });
  it("keeps barcode provenance in backups and accepts old backups", () => {
    const data = seed();
    expect(validateBackup(data).foods).toHaveLength(16);
    data.foods[0] = {
      ...data.foods[0],
      barcode: code,
      source: "openfoodfacts",
    };
    expect(
      validateBackup(JSON.parse(JSON.stringify(data))).foods[0].barcode,
    ).toBe(code);
  });
});
describe("label parsing and portions", () => {
  it("reads per-100g values including actual zero and gram serving weight", () => {
    const result = parseOpenFoodFacts(
      payload({
        product_name: "Test food",
        brands: "Example",
        serving_size: "2 pieces (30 g)",
        nutriments: {
          "energy-kcal_100g": 400,
          proteins_100g: 20,
          carbohydrates_100g: 0,
          fat_100g: 30,
        },
      }),
      code,
    )!;
    expect(result.macros).toEqual({
      calories: 400,
      protein: 20,
      carbs: 0,
      fat: 30,
    });
    expect(result.servingGrams).toBe(30);
    expect(result.basis).toBe("100g");
    const food = {
      ...seed().foods[0],
      ...result,
      macros: result.macros as {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      },
    };
    expect(foodMacros(food, 2, "serving").calories).toBe(240);
  });
  it("converts kilojoules when kilocalories are missing", () => {
    expect(
      parseOpenFoodFacts(
        payload({ nutriments: { "energy-kj_100g": 418.4 } }),
        code,
      )?.macros.calories,
    ).toBeCloseTo(100);
  });
  it("preserves missing, empty, negative and nonnumeric values as unknown", () => {
    expect(
      parseOpenFoodFacts(
        payload({
          nutriments: {
            "energy-kcal_100g": "",
            proteins_100g: -1,
            carbohydrates_100g: "unknown",
            fat_100g: 0,
          },
        }),
        code,
      )?.macros,
    ).toEqual({ calories: null, protein: null, carbs: null, fat: 0 });
  });
  it("does not silently substitute zero for manual labels", () => {
    expect(Object.values(blankBarcodeProduct(code).macros)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
  it("uses serving values if these are the only values supplied", () => {
    const r = parseOpenFoodFacts(
      payload({
        nutriments: {
          "energy-kcal_serving": 110,
          proteins_serving: 10,
          carbohydrates_serving: 8,
          fat_serving: 4,
        },
      }),
      code,
    )!;
    expect(r.basis).toBe("serving");
    expect(r.macros.calories).toBe(110);
  });
  it("never infers grams from milliliters", () => {
    const r = parseOpenFoodFacts(
      payload({
        nutrition_data_per: "100ml",
        serving_size: "250 ml",
        serving_quantity: 250,
        serving_quantity_unit: "ml",
        nutriments: { "energy-kcal_100g": 40, "energy-kcal_serving": 100 },
      }),
      code,
    )!;
    expect(r.servingGrams).toBe(0);
    expect(r.basis).toBe("serving");
    expect(r.macros.calories).toBe(100);
  });
  it("recognizes ounces and rejects unknown-weight serving calculations", () => {
    expect(
      parseOpenFoodFacts(
        payload({ serving_size: "1 oz", nutriments: { fat_100g: 1 } }),
        code,
      )?.servingGrams,
    ).toBeCloseTo(28.349523125);
    const f = { ...seed().foods[0], servingGrams: 0 };
    expect(() => foodMacros(f, 1, "serving")).toThrow("serving weight");
    expect(foodMacros(f, 100, "g").calories).toBe(165);
  });
  it("handles missing product and mismatched results", () => {
    expect(parseOpenFoodFacts({ status: 0 }, code)).toBeNull();
    expect(() => parseOpenFoodFacts({}, code)).toThrow();
    expect(() =>
      parseOpenFoodFacts(
        { status: 1, product: { code: "737628064502" } },
        code,
      ),
    ).toThrow("different barcode");
  });
});
describe("remote lookup", () => {
  afterEach(() => vi.useRealTimers());
  it("uses an anonymous narrow product request and parses it", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify(
            payload({ product_name: "Test", nutriments: { fat_100g: 1 } }),
          ),
        ),
      );
    const result = await lookupBarcode(
      code,
      new AbortController().signal,
      fetcher,
    );
    expect(result?.name).toBe("Test");
    expect(fetcher.mock.calls[0][0]).toContain(`/product/${code}.json?fields=`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  });
  it("handles not-found and rate limits", async () => {
    expect(
      await lookupBarcode(
        code,
        new AbortController().signal,
        vi.fn().mockResolvedValue(new Response("", { status: 404 })),
      ),
    ).toBeNull();
    await expect(
      lookupBarcode(
        code,
        new AbortController().signal,
        vi.fn().mockResolvedValue(new Response("", { status: 429 })),
      ),
    ).rejects.toThrow("rate-limited");
  });
  it("handles network errors without overwriting local data", async () => {
    await expect(
      lookupBarcode(
        code,
        new AbortController().signal,
        vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      ),
    ).rejects.toThrow("connection");
  });
  it("cancels a request when the dialog closes", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(
      (_url: unknown, options: RequestInit) =>
        new Promise<Response>((_, reject) =>
          options.signal!.addEventListener("abort", () =>
            reject(new DOMException("cancel", "AbortError")),
          ),
        ),
    );
    const pending = lookupBarcode(
      code,
      controller.signal,
      fetcher as typeof fetch,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  it("times out instead of leaving a spinner indefinitely", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: unknown, options: RequestInit) =>
        new Promise<Response>((_, reject) =>
          options.signal!.addEventListener("abort", () =>
            reject(new DOMException("cancel", "AbortError")),
          ),
        ),
    );
    const pending = expect(
      lookupBarcode(
        code,
        new AbortController().signal,
        fetcher as typeof fetch,
      ),
    ).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(12000);
    await pending;
  });
});
