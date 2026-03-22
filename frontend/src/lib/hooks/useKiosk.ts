// Requests fullscreen when the staff app loads on a tablet.
// Works in combination with iOS Guided Access or Android Screen Pinning for
// proper kiosk lockdown — the web API alone is not a security boundary.

import { useEffect } from 'react'

export function useKiosk() {
  useEffect(() => {
    const el = document.documentElement

    function requestFullscreen() {
      if (!document.fullscreenElement) {
        el.requestFullscreen?.().catch(() => {/* browser may deny without user gesture */})
      }
    }

    // Re-request fullscreen if the user somehow exits it
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) requestFullscreen()
    })

    requestFullscreen()
  }, [])
}
