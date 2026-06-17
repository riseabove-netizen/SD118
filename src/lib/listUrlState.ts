import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'

/**
 * Lightweight URL-search-params hook. wouter's useLocation only tracks the
 * path, so we manage `window.location.search` directly and trigger reactivity
 * with a popstate listener + an internal version bump.
 *
 * Filter selections + search persist across navigation: back from item detail
 * returns the user to the list with the same query string intact.
 */
export function useUrlParams(): [URLSearchParams, (mutate: (p: URLSearchParams) => void) => void] {
  // useLocation re-renders the component when the path changes (e.g. when the
  // user navigates back). That's enough to re-read window.location.search.
  const [pathname] = useLocation()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    function onPop() { setTick(t => t + 1) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const params = useMemo(() => {
    return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tick])

  function update(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(window.location.search)
    mutate(next)
    const qs = next.toString()
    const url = window.location.pathname + (qs ? '?' + qs : '')
    window.history.replaceState(null, '', url)
    setTick(t => t + 1)
  }

  return [params, update]
}

/** Helper: read a single value with default "". */
export function getParam(params: URLSearchParams, key: string): string {
  return params.get(key) || ''
}

/** Helper: read multi-values (comma-separated in the URL). */
export function getMultiParam(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key)
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/** Helper: set or delete a single value. */
export function setSingle(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value)
  else params.delete(key)
}

/** Helper: set or delete a multi-value. */
export function setMulti(params: URLSearchParams, key: string, values: string[]) {
  if (values && values.length > 0) params.set(key, values.join(','))
  else params.delete(key)
}
