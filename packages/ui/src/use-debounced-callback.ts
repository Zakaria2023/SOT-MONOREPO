"use client";

import { useEffect, useRef } from "react";

/**
 * Returns a debounced version of `callback` that only fires after `delay` ms
 * have passed without another call. The latest callback is always used, and any
 * pending timer is cleared on unmount. Shared by the admin list search and the
 * client catalog search so both debounce identically.
 */
export const useDebouncedCallback = <Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
) => {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  return (...args: Args) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
  };
};
