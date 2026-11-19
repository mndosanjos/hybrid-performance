import { useEffect, useRef, useState } from "react";
import { Camera, ScanBarcode, Square, ArrowLeft } from "lucide-react";
import { Button, Field, Modal, NumberInput } from "./components";
import { Food, Macros, uid } from "./model";
import { macroKeys } from "./logic";
import {
  BarcodeProduct,
  blankBarcodeProduct,
  findBarcodeFood,
  lookupBarcode,
  normalizeBarcode,
} from "./barcodes";

export default function BarcodeDialog({
  foods,
  onClose,
  onChoose,
  onSave,
}: {
  foods: Food[];
  onClose: () => void;
  onChoose: (food: Food) => void;
  onSave: (food: Food) => void;
}) {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [camera, setCamera] = useState<"off" | "starting" | "on">("off"),
    [busy, setBusy] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [deviceId, setDeviceId] = useState(""),
    [scanHelp, setScanHelp] = useState(false),
    [product, setProduct] = useState<BarcodeProduct | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [message, setMessage] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    controls = useRef<{ stop: () => void } | null>(null),
    generation = useRef(0),
    request = useRef<AbortController | null>(null),
    mounted = useRef(true),
    lookupBusy = useRef(false);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setScanHelp(false);
    if (camera !== "on") return;
    const timeout = window.setTimeout(() => setScanHelp(true), 10000);
    return () => window.clearTimeout(timeout);
  }, [camera]);
  function stopCamera() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (mounted.current) setCamera("off");
  }
  useEffect(() => {
    mounted.current = true;
    const hidden = () => {
      if (document.hidden) stopCamera();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      request.current?.abort();
      stopCamera();
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  function close() {
    request.current?.abort();
    stopCamera();
    onClose();
  }
  async function search(raw: string) {
    if (lookupBusy.current) return;
    let normalized: string;
    try {
      normalized = normalizeBarcode(raw);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    stopCamera();
    setCode(normalized);
    setError("");
    setMessage("");
    const saved = findBarcodeFood(foods, normalized);
    if (saved) {
      onChoose(saved);
      return;
    }
    if (!navigator.onLine) {
      setMessage(
        "This barcode is not saved on this device. Go online to look it up, or enter the label below.",
      );
      setProduct(blankBarcodeProduct(normalized));
      setConfirmed(false);
      return;
    }
    lookupBusy.current = true;
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await lookupBarcode(normalized, controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      setProduct(result ?? blankBarcodeProduct(normalized));
      setConfirmed(false);
      if (!result)
        setMessage(
          "Product not found. Enter its label once and this barcode will be saved for next time.",
        );
    } catch (e) {
      if (!controller.signal.aborted && mounted.current)
        setError((e as Error).message);
    } finally {
      lookupBusy.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function readPhoto(file: File) {
    stopCamera();
    const token = generation.current;
    setError("");
    setPhotoBusy(true);
    let value: string | undefined;
    try {
      const { scanPhoto } = await import("./scanner");
      if (!mounted.current || token !== generation.current) return;
      value = await scanPhoto(file);
    } catch (e) {
      if (mounted.current && token === generation.current)
        setError(
          (e as Error).message ||
            "Could not read this photo. Try a JPG or PNG, or type the barcode.",
        );
    } finally {
      if (mounted.current) setPhotoBusy(false);
    }
    if (value && mounted.current && token === generation.current)
      void search(value);
  }
  async function startCamera(selectedId = deviceId) {
    setError("");
    setMessage("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera scanning requires HTTPS (or localhost). Open the installed app’s secure address, or type the barcode below.",
      );
      return;
    }
    stopCamera();
    const token = generation.current;
    setCamera("starting");
    try {
      const { createScanner, focusCamera } = await import("./scanner");
      if (!mounted.current || token !== generation.current) return;
      const acquired = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(selectedId
            ? { deviceId: { exact: selectedId } }
            : { facingMode: { ideal: "environment" } }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (!mounted.current || token !== generation.current) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = acquired;
      const track = acquired.getVideoTracks()[0];
      await focusCamera(track);
      if (!mounted.current || token !== generation.current) return;
      setDeviceId(track.getSettings().deviceId ?? selectedId);
      // Device names are available after camera permission. Enumeration failure is nonfatal.
      void navigator.mediaDevices
        .enumerateDevices()
        .then((items) => {
          if (mounted.current && token === generation.current)
            setDevices(items.filter((d) => d.kind === "videoinput"));
        })
        .catch(() => {});
      const reader = createScanner();
      const c = await reader.decodeFromStream(
        acquired,
        video.current!,
        (result, _error, scanner) => {
          if (!result || token !== generation.current || !mounted.current)
            return;
          let value: string;
          try {
            value = normalizeBarcode(result.getText());
          } catch {
            return;
          }
          scanner.stop();
          void search(value);
        },
      );
      if (!mounted.current || token !== generation.current) {
        c.stop();
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      controls.current = c;
      setCamera("on");
    } catch (e) {
      if (!mounted.current || token !== generation.current) return;
      stopCamera();
      const name = (e as Error).name;
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser’s site settings, or type the barcode."
          : name === "NotFoundError"
            ? "No camera was found. You can type the barcode below."
            : name === "NotReadableError"
              ? "The camera is in use by another app. Close that app and retry, or type the barcode."
              : "Unable to start the camera. Try again or type the barcode below.",
      );
    }
  }
  const ready =
    product &&
    product.name.trim() &&
    Object.values(product.macros).every(
      (v) => v !== null && Number.isFinite(v) && v >= 0,
    ) &&
    confirmed;
  return (
    <Modal
      title={product ? "Review scanned food" : "Scan a food barcode"}
      open
      onClose={close}
    >
      {!product ? (
        <>
          <p>
            Scan a UPC-A or EAN product barcode, or type the printed digits.
            Saved foods are checked first, even offline.
          </p>
          <div
            className={`barcode-camera ${camera === "off" ? "inactive" : ""}`}
          >
            <video
              ref={video}
              muted
              playsInline
              autoPlay
              aria-label="Live barcode camera preview"
            />
            {camera === "off" ? (
              <div className="barcode-camera-hint">
                <ScanBarcode size={48} />
                <span>Keep the entire barcode visible and in focus</span>
              </div>
            ) : (
              <div className="barcode-frame" aria-hidden="true" />
            )}
          </div>
          <div className="row wrap">
            <Button
              onClick={() => void startCamera()}
              disabled={camera !== "off" || busy || photoBusy}
            >
              <Camera size={18} />
              {camera === "starting"
                ? "Opening camera…"
                : camera === "on"
                  ? "Camera scanning…"
                  : "Start camera"}
            </Button>
            {camera !== "off" && (
              <Button variant="secondary" onClick={stopCamera}>
                <Square size={16} /> Stop camera
              </Button>
            )}
          </div>
          {devices.length > 1 && (
            <Field label="Camera">
              <select
                value={deviceId}
                disabled={busy || photoBusy || camera === "starting"}
                onChange={(e) => {
                  setDeviceId(e.target.value);
                  if (camera === "on") void startCamera(e.target.value);
                }}
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {camera === "on" && (
            <p role="status" className="caption">
              {scanHelp
                ? "Still looking. Move the package farther away if it is blurry, avoid glare, and hold it steady. A photo or the printed digits may work better with a webcam."
                : "Scanning… Hold the bars horizontally, with white space visible on both ends."}
            </p>
          )}
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readPhoto(file);
            }}
          />
          <Button
            variant="secondary"
            disabled={busy || photoBusy}
            onClick={() => {
              stopCamera();
              photoInput.current?.click();
            }}
          >
            {photoBusy ? "Reading photo…" : "Scan a photo"}
          </Button>
          <p className="caption">
            Use bright, even light. If a webcam cannot focus close up, move back
            rather than filling the whole screen. Camera images and selected
            photos stay on your device. New lookups send only the barcode to
            Open Food Facts; no workout or meal history is sent.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search(code);
            }}
          >
            <Field label="Barcode digits">
              <input
                autoComplete="off"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="UPC / EAN barcode"
                disabled={busy || photoBusy}
              />
            </Field>
            <div className="row wrap">
              <Button
                type="submit"
                disabled={busy || photoBusy || !code.trim()}
              >
                {busy ? "Looking up food…" : "Find food"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || photoBusy || !code.trim()}
                onClick={() => {
                  try {
                    const draft = blankBarcodeProduct(code);
                    stopCamera();
                    setProduct(draft);
                    setConfirmed(false);
                    setError("");
                    setMessage(
                      "Enter your package label to save this barcode.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Enter label manually
              </Button>
              {busy && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => request.current?.abort()}
                >
                  Cancel lookup
                </Button>
              )}
            </div>
          </form>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setProduct(null);
              setConfirmed(false);
              setMessage("");
              setError("");
            }}
          >
            <ArrowLeft size={16} /> Scan another
          </Button>
          <p className="caption">
            Barcode {product.barcode}
            {product.source === "openfoodfacts" && (
              <>
                {" "}
                ·{" "}
                <a
                  href={`https://world.openfoodfacts.org/product/${product.barcode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Food Facts product
                </a>
              </>
            )}
          </p>
          {message && (
            <div className="callout" role="status">
              {message}
            </div>
          )}
          {product.warnings.map((w) => (
            <p key={w} className="caption">
              {w}
            </p>
          ))}
          <Field label="Scanned food name">
            <input
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
          </Field>
          <Field label="Brand">
            <input
              value={product.brand}
              onChange={(e) =>
                setProduct({ ...product, brand: e.target.value })
              }
            />
          </Field>
          <div className="form-grid">
            <Field label="Nutrition values are for">
              <select
                value={product.basis}
                onChange={(e) => {
                  setProduct({
                    ...product,
                    basis: e.target.value as "100g" | "serving",
                    macros: {
                      calories: null,
                      protein: null,
                      carbs: null,
                      fat: null,
                    },
                  });
                  setConfirmed(false);
                }}
              >
                <option value="100g">100 grams</option>
                <option value="serving">One serving</option>
              </select>
            </Field>
            <Field label="One serving weighs (grams, optional)">
              <NumberInput
                value={product.servingGrams || null}
                onChange={(v) =>
                  setProduct({ ...product, servingGrams: v ?? 0 })
                }
              />
            </Field>
          </div>
          <Field label="Serving description">
            <input
              value={product.servingDescription}
              onChange={(e) =>
                setProduct({ ...product, servingDescription: e.target.value })
              }
            />
          </Field>
          <div className="form-grid">
            {macroKeys.map((k) => (
              <Field
                key={k}
                label={
                  k === "calories" ? "Label calories (kcal)" : `Label ${k} (g)`
                }
              >
                <NumberInput
                  value={product.macros[k]}
                  onChange={(v) =>
                    setProduct({
                      ...product,
                      macros: { ...product.macros, [k]: v },
                    })
                  }
                  placeholder="Enter label value"
                />
              </Field>
            ))}
          </div>
          <p className="caption">
            Changing the nutrition basis clears the values so per-serving and
            per-100-gram amounts cannot be mixed. Unknown serving weight limits
            which quantity units can be used.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I checked the product, serving basis and nutrition against the
            package.
          </label>
          <Button
            disabled={!ready}
            onClick={() => {
              if (!product || !ready) return;
              const existing = findBarcodeFood(foods, product.barcode);
              if (existing) {
                onChoose(existing);
                return;
              }
              onSave({
                id: uid(),
                name: product.name.trim(),
                brand: product.brand.trim(),
                basis: product.basis,
                servingGrams: product.servingGrams,
                servingDescription: product.servingDescription || "1 serving",
                macros: product.macros as Macros,
                estimate: false,
                favorite: false,
                barcode: product.barcode,
                source: product.source,
              });
            }}
          >
            Save food & choose portion
          </Button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="caption">
        Product data:{" "}
        <a
          href="https://world.openfoodfacts.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Food Facts
        </a>{" "}
        contributors ·{" "}
        <a
          href="https://opendatacommons.org/licenses/odbl/1-0/"
          target="_blank"
          rel="noopener noreferrer"
        >
          ODbL
        </a>
        . Community data can be incomplete or incorrect.
      </p>
    </Modal>
  );
}
