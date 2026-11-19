import { useEffect, useState } from "react";
import { localDate } from "./logic";

export function useToday(timezone: string) {
  const [today, setToday] = useState(() => localDate(timezone));
  useEffect(() => {
    const refresh = () => setToday(localDate(timezone));
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [timezone]);
  return today;
}
