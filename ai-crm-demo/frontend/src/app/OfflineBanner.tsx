import { useOnlineStatus } from '../lib/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        background: '#7f1d1d',
        color: '#fff',
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      オフラインです。保存や送信操作はオンライン復帰後に実行してください。
    </div>
  )
}
