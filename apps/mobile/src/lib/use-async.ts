import { useCallback, useEffect, useState } from "react";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

type AsyncResult<T> = AsyncState<T> & { reload: () => void };

// Runs an async loader and tracks loading/error/data. Pass a `fn` memoized with
// useCallback so it only re-runs when its inputs change; `reload()` re-runs it
// on demand (e.g. a retry button or pull-to-refresh).
export const useAsync = <T,>(fn: () => Promise<T>): AsyncResult<T> => {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fn().then(
      (data) => {
        if (active) {
          setState({ data, error: null, loading: false });
        }
      },
      (err: unknown) => {
        if (active) {
          setState({
            data: null,
            error: err instanceof Error ? err.message : "Failed to load",
            loading: false,
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [fn, nonce]);

  return { ...state, reload };
};
