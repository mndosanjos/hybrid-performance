import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowUpRight } from "lucide-react";
import { Macros } from "./model";
import { macroKeys } from "./logic";
export function Button({
  children,
  variant = "",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return (
    <button className={`btn ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = "any",
  ...rest
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: string | number;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "step"
>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value === "" ? null : Number(e.target.value);
        if (
          v === null ||
          (Number.isFinite(v) && v >= min && (max === undefined || v <= max))
        )
          onChange(v);
      }}
      {...rest}
    />
  );
}
export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="row between">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="icon" aria-label="Close dialog">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {title}. Changes are saved when you use the action button below.
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function MacroBars({
  consumed,
  goals,
}: {
  consumed: Macros;
  goals: Macros;
}) {
  return (
    <div className="macro-bars">
      {macroKeys.map((k, i) => {
        const v = consumed[k],
          g = goals[k],
          diff = g - v;
        return (
          <div key={k} className={`macro macro-${i}`}>
            <div className="row between">
              <span>
                {k === "carbs"
                  ? "Carbohydrates"
                  : k[0].toUpperCase() + k.slice(1)}
              </span>
              <span>
                <strong>{Math.round(v).toLocaleString()}</strong>
                <small>
                  {" "}
                  / {g.toLocaleString()}
                  {i ? " g" : " kcal"}
                </small>
              </span>
            </div>
            <div
              className="track"
              role="progressbar"
              aria-label={k}
              aria-valuenow={Math.round(v)}
              aria-valuemax={Math.max(g, v)}
            >
              <i
                style={{
                  width: `${g > 0 ? Math.min(100, (v / g) * 100) : v ? 100 : 0}%`,
                }}
              />
            </div>
            <small className={diff < 0 ? "overage" : ""}>
              {Math.round(Math.abs(diff))}
              {i ? " g" : " kcal"} {diff < 0 ? "over target" : "remaining"}
            </small>
          </div>
        );
      })}
    </div>
  );
}
export function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <ArrowUpRight size={28} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {children}
    </div>
  );
}
export function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const confirmDelete = (what: string) =>
  window.confirm(
    `Delete ${what}? This cannot be undone. Export a backup first if needed.`,
  );
