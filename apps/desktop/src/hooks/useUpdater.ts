import { useCallback, useEffect, useRef, useState } from "react";
import { createUpdater, type UpdateState } from "../lib/updater";

export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ s: "idle" });
  const controller = useRef<ReturnType<typeof createUpdater> | null>(null);
  useEffect(() => {
    const instance = createUpdater(setState);
    controller.current = instance;
    let lastCheck = 0;
    const automaticCheck = () => {
      if (Date.now() - lastCheck < 15 * 60_000) return;
      lastCheck = Date.now();
      void instance.checkNow();
    };
    automaticCheck();
    const timer = window.setInterval(automaticCheck, 4 * 60 * 60_000);
    window.addEventListener("focus", automaticCheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", automaticCheck);
      instance.dispose();
      if (controller.current === instance) controller.current = null;
    };
  }, []);
  const checkNow = useCallback(() => controller.current?.checkNow(), []);
  const install = useCallback(() => controller.current?.install(), []);
  const restart = useCallback(() => controller.current?.restart(), []);
  return { state, checkNow, install, restart };
}
