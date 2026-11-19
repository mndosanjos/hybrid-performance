import { it, expect } from "vitest";
import {
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource,
  MultiFormatReader,
} from "@zxing/library";

import { scannerHints } from "./scanner";

it.each([10, 65, 100])(
  "decodes a barcode at vertical offset %i with production hints",
  (offset) => {
    // An independent EAN-13 raster fixture, including quiet zones and guard bars.
    const code = "3017620422003",
      patterns = [
        "0001101",
        "0011001",
        "0010011",
        "0111101",
        "0100011",
        "0110001",
        "0101111",
        "0111011",
        "0110111",
        "0001011",
      ];
    const inverse = (bits: string) =>
      bits.replace(/[01]/g, (b) => (b === "1" ? "0" : "1"));
    const parity = "LLGGGL";
    const left = code
      .slice(1, 7)
      .split("")
      .map((d, i) =>
        parity[i] === "L"
          ? patterns[+d]
          : inverse(patterns[+d]).split("").reverse().join(""),
      )
      .join("");
    const right = code
      .slice(7)
      .split("")
      .map((d) => inverse(patterns[+d]))
      .join("");
    const bits =
      "0".repeat(12) + "101" + left + "01010" + right + "101" + "0".repeat(12);
    const width = bits.length * 3,
      height = 120,
      pixels = new Uint8ClampedArray(width * height).fill(255);
    for (let y = offset; y < Math.min(height, offset + 15); y++)
      for (let x = 0; x < width; x++)
        if (bits[Math.floor(x / 3)] === "1") pixels[y * width + x] = 0;
    const bitmap = new BinaryBitmap(
      new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)),
    );
    const reader = new MultiFormatReader();
    expect(reader.decode(bitmap, scannerHints).getText()).toBe(code);
  },
);
