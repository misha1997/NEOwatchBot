// useApi — fetch an /api endpoint, keep loading/error state, optionally poll,
// and refetch when `deps` change (e.g. the observer location). Replaces the
// fire-and-forget loaders in app.js with React-friendly state.
import { useEffect, useRef, useState, useCallback } from "react";

// `fetcher` is either a () => Promise<data> function, or a plain URL string.
// `deps` controls refetch. `interval` (ms) enables polling; 0 = off.
export function useApi(fetcher, { deps = [], interval = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const run = useCallback(async () => {
    try {
      const fn = typeof fetcher === "function" ? fetcher : () => fetch(fetcher).then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
      const d = await fn();
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    run();
    let id = null;
    if (interval > 0) id = setInterval(run, interval);
    return () => { alive.current = false; if (id) clearInterval(id); };
  }, [run, interval]);

  return { data, error, loading, refetch: run };
}