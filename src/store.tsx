import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Data } from "./model";
import { loadData, persist } from "./storage";
type Store = {
  data: Data;
  update: (fn: (d: Data) => Data) => void;
  saving: boolean;
  error: string;
  retry: () => void;
  flush: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const current = useRef<Data | null>(null),
    saved = useRef<Data | null>(null),
    queue = useRef(Promise.resolve()),
    revision = useRef(0);
  useEffect(() => {
    loadData()
      .then((d) => {
        current.current = d;
        saved.current = d;
        setData(d);
      })
      .catch((e) =>
        setError(
          `Unable to open local data: ${e.message}. Existing data has not been reset.`,
        ),
      );
    const onDraftError = (e: Event) =>
      setError(
        `Draft save failed: ${(e as CustomEvent).detail}. Keep the form open and save the entry before closing.`,
      );
    window.addEventListener("hybrid-save-error", onDraftError);
    return () => window.removeEventListener("hybrid-save-error", onDraftError);
  }, []);
  const save = (next: Data) => {
    const rev = ++revision.current;
    setSaving(true);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        try {
          await persist(next, saved.current ?? undefined);
          saved.current = next;
          if (rev === revision.current) {
            setSaving(false);
            setError("");
          }
        } catch (e) {
          setSaving(false);
          setError(
            `Save failed: ${String(e)}. Keep this page open and export a backup before closing.`,
          );
          throw e;
        }
      });
    queue.current.catch(() => {});
  };
  const update = (fn: (d: Data) => Data) => {
    if (!current.current) return;
    const next = fn(current.current);
    current.current = next;
    setData(next);
    save(next);
  };
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (current.current !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  if (!data)
    return (
      <div className="boot">
        <div className="brand-mark">H</div>
        <h1>Hybrid Performance</h1>
        <p>{error || "Opening your training log…"}</p>
        {error && (
          <button onClick={() => location.reload()}>Retry opening data</button>
        )}
      </div>
    );
  return (
    <Context.Provider
      value={{
        data,
        update,
        saving,
        error,
        retry: () => save(current.current!),
        flush: () => queue.current,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context)!;
