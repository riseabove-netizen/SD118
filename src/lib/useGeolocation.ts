import { useEffect, useState } from 'react'

export interface GeoPosition {
  lat: number
  lon: number
  accuracy: number
  timestamp: number
}

export interface GeoState {
  position: GeoPosition | null
  formatted: string
  error: string | null
  loading: boolean
}

/**
 * Format coordinates as e.g. "N 39°47.945' E 2°28.843'"
 */
export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  const aLat = Math.abs(lat)
  const aLon = Math.abs(lon)
  const latDeg = Math.floor(aLat)
  const latMin = (aLat - latDeg) * 60
  const lonDeg = Math.floor(aLon)
  const lonMin = (aLon - lonDeg) * 60
  return `${ns} ${latDeg}°${latMin.toFixed(3).padStart(6, '0')}' ${ew} ${lonDeg}°${lonMin.toFixed(3).padStart(6, '0')}'`
}

/**
 * Hook that reads the device's current GPS position once on mount.
 * Returns formatted string plus raw lat/lon for storage.
 */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({
    position: null,
    formatted: '',
    error: null,
    loading: true,
  })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState({ position: null, formatted: '', error: 'Geolocation not supported', loading: false })
      return
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setState({
          position: {
            lat,
            lon,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          },
          formatted: formatCoords(lat, lon),
          error: null,
          loading: false,
        })
      },
      err => {
        setState({
          position: null,
          formatted: '',
          error: err.message || 'Unable to read location',
          loading: false,
        })
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    )
  }, [])

  return state
}