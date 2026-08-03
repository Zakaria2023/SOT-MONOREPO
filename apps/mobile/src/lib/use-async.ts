import { useCallback, useEffect, useRef, useState } from "react";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

type AsyncResult<T> = AsyncState<T> & { reload: () => void };

/**
 * Runs an async loader and tracks loading / error / data.
 *
 * The loader is held in a ref and deliberately kept OUT of the effect's
 * dependencies. It used to be a dependency, which made this hook loop forever
 * whenever the caller's `fn` was not referentially stable:
 *
 *   effect runs -> setState(loading) -> re-render -> new `fn` identity
 *     -> effect runs -> setState(loading) -> ...
 *
 * The effect sets state unconditionally on entry, so an unstable `fn` closes the
 * circle with nothing to damp it. Every turn fired a real request and none were
 * aborted, so the browser eventually refused to open more sockets
 * (ERR_INSUFFICIENT_RESOURCES) and the screen span forever. It showed up on the
 * profile screen, whose loader closes over Clerk's `getToken`; six other screens
 * share that exact shape.
 *
 * Re-running is now driven by `key` — an explicit string naming the inputs the
 * loader actually depends on (a uuid, a serialized query). A screen with no
 * varying inputs passes nothing and loads once; `reload()` still re-runs on
 * demand. The credential is not an input: `getToken` may stay in a caller's
 * useCallback deps to satisfy exhaustive-deps, and it no longer costs anything.
 */
export const useAsync = <T,>(
  fn: () => Promise<T>,
  key = "",
): AsyncResult<T> => {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  // Refreshed on every render so a re-run always calls the latest closure,
  // without the identity of that closure being able to cause the re-run.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    fnRef.current().then(
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
  }, [key, nonce]);

  return { ...state, reload };
};
