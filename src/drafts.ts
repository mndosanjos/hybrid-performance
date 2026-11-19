import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { db } from "./storage";
// Form drafts are separate from committed history and intentionally not exported.
// IndexedDB requests are issued as fields change; there is no unload-only debounce.
export function useDraft<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial),
    [ready, setReady] = useState(false);
  const edited = useRef(false);
  useEffect(() => {
    let alive = true;
    db.table("meta")
      .get("draft:" + key)
      .then((row) => {
        if (alive) {
          if (row && !edited.current) setValue(row.value as T);
          setReady(true);
        }
      })
      .catch((e) => {
        window.dispatchEvent(
          new CustomEvent("hybrid-save-error", { detail: String(e) }),
        );
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [key]);
  useEffect(() => {
    if (ready)
      db.table("meta")
        .put({ id: "draft:" + key, value })
        .catch((e) =>
          window.dispatchEvent(
            new CustomEvent("hybrid-save-error", { detail: String(e) }),
          ),
        );
  }, [value, ready, key]);
  return [
    value,
    (next) => {
      edited.current = true;
      setValue(next);
    },
  ];
}
