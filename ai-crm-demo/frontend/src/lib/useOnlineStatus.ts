import { useEffect, useState } from 'react'

function getOnlineStatus() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(getOnlineStatus)

  useEffect(() => {
    function update() {
      setIsOnline(getOnlineStatus())
    }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return isOnline
}
