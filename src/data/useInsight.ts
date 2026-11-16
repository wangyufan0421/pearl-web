import { useEffect, useState } from "react";
import { getInsight, type InsightKey, type InsightPayload } from "./insights";
import type { DataResult } from "./prlstats";

export function useInsight<K extends InsightKey>(key: K, interval: number) {
  const [result, setResult] = useState<DataResult<InsightPayload<K>> | null | undefined>();
  useEffect(() => {
    let active = true;
    const update = () => { void getInsight(key).then(next => {
      if (!active) return;
      setResult(previous => next ?? (previous?.sourceKind === "live" ? { ...previous, stale: true, notice: "当前显示上次成功保存的数据，后台仍在尝试更新。" } : null));
    }); };
    update();
    const timer = window.setInterval(update, interval);
    return () => { active = false; window.clearInterval(timer); };
  }, [key, interval]);
  return result;
}
