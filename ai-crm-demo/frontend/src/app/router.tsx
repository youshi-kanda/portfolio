import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { LoginPage } from '../features/auth'
import { CampaignDetailPage, CampaignListPage } from '../features/campaigns'
import { CustomerDetailPage, CustomerListPage } from '../features/customers'
import { DashboardPage } from '../features/dashboard'
import { ReportsPage } from '../features/reports'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/stores/:storeId',
    element: <Layout />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'customers', element: <CustomerListPage /> },
      { path: 'customers/:customerId', element: <CustomerDetailPage /> },
      { path: 'campaigns', element: <CampaignListPage /> },
      { path: 'campaigns/:campaignId', element: <CampaignDetailPage /> },
      { path: 'reports', element: <ReportsPage /> },
    ],
  },
])

export { router }
