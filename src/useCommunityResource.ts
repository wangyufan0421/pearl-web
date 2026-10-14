import { useEffect, useState } from "react";
import { CommunityReadError } from "./data/communityDiscussion";

type ResourceState<T> = { data: T | null; loading: boolean; refreshing: boolean; error: "missing" | "unavailable" | null };
export function useCommunityResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<ResourceState<T>>({ data: null, loading: true, refreshing: true, error: null });
  const [retryVersion, setRetryVersion] = useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let request: AbortController | undefined;
    const sync = async () => {
      if (!active || inFlight) return;
      inFlight = true;
      request = new AbortController();
      setState(previous => ({ ...previous, loading: previous.data === null, refreshing: true, error: null }));
      try {
        const data = await loader(request.signal);
        if (active) setState({ data, loading: false, refreshing: false, error: null });
      } catch (error) {
        if (active) setState(previous => ({ ...previous, ...(error instanceof CommunityReadError && error.kind === "missing" ? { data: null } : {}), loading: false, refreshing: false, error: error instanceof CommunityReadError ? error.kind : "unavailable" }));
      } finally { inFlight = false; }
    };
    void sync();
    const onFocus = () => { void sync(); };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => { active = false; request?.abort(); window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [loader, retryVersion]);
  return { ...state, retry: () => setRetryVersion(version => version + 1) };
}
