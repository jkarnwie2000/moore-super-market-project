import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

/**
 * Fetches `path` with `params` and tracks loading / error state.
 * Re-runs when the serialised params change; stale responses are discarded.
 */
export function useApi(path, params) {
  const key = JSON.stringify(params || {});
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: null });
  const [reloadToken, setReloadToken] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    api
      .get(path, JSON.parse(key), { signal: controller.signal })
      .then((data) => id === latest.current && setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        if (id === latest.current) setState({ data: null, loading: false, error });
      });
    return () => controller.abort();
  }, [path, key, reloadToken]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);
  return { ...state, reload };
}
