import { useEffect, useRef } from 'react';

export function usePolling(fn: () => void, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    fnRef.current(); // run immediately on mount
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id); // clear on unmount
  }, [intervalMs]);
}
