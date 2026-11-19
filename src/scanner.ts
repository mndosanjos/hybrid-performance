import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export const scannerHints = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

export function createScanner() {
  return new BrowserMultiFormatReader(scannerHints, {
    delayBetweenScanAttempts: 200,
  });
}

// Focus is optional: fixed-focus webcams and unsupported browsers still scan.
export async function focusCamera(track: MediaStreamTrack) {
  try {
    const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
      focusMode?: string[];
    };
    if (caps?.focusMode?.includes("continuous")) {
      await track.applyConstraints({
        advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
      });
    }
  } catch {
    /* A rejected optional focus setting must not stop scanning. */
  }
}

export async function scanPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Choose a photo of the barcode.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const reader = createScanner();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo scanning is unavailable in this browser.");
    // Bound memory and try both orientations and scales for small printed bars.
    for (const limit of [1600, 2400]) {
      const scale = Math.min(1, limit / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      for (const rotated of [false, true]) {
        canvas.width = rotated ? height : width;
        canvas.height = rotated ? width : height;
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (rotated) {
          context.translate(height, 0);
          context.rotate(Math.PI / 2);
        }
        context.drawImage(image, 0, 0, width, height);
        try {
          return reader.decodeFromCanvas(canvas).getText();
        } catch {
          /* Try the next orientation. */
        }
      }
    }
    throw new Error(
      "No barcode found in that photo. Crop close to the barcode, keep its white edges visible, and try again—or type the digits.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
