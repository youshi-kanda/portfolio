import { RouterProvider } from 'react-router-dom'
import { OfflineBanner } from './OfflineBanner'
import { router } from './router'

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <OfflineBanner />
    </>
  )
}

export default App
