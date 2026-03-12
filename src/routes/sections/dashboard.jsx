import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { CONFIG } from 'src/config-global';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { AuthGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const OverviewPage = lazy(() => import('src/pages/dashboard/overview'));
const UsersPage = lazy(() => import('src/pages/dashboard/one'));
const PageTwo = lazy(() => import('src/pages/dashboard/two'));
const RefundRequestsPage = lazy(() => import('src/pages/dashboard/refund-requests'));
const BannerPage = lazy(() => import('src/pages/dashboard/banner'));
const SubscriptionsPage = lazy(() => import('src/pages/dashboard/subscriptions'));
const PageThree = lazy(() => import('src/pages/dashboard/three'));
const PageFour = lazy(() => import('src/pages/dashboard/four'));
const PageFive = lazy(() => import('src/pages/dashboard/five'));
const PageSix = lazy(() => import('src/pages/dashboard/six'));

// ----------------------------------------------------------------------

const layoutContent = (
  <DashboardLayout>
    <Suspense fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  </DashboardLayout>
);

export const dashboardRoutes = [
  {
    path: 'dashboard',
    element: CONFIG.auth.skip ? <>{layoutContent}</> : <AuthGuard>{layoutContent}</AuthGuard>,
    children: [
      { element: <OverviewPage />, index: true },
      { path: 'users', element: <UsersPage /> },
      { path: 'subscriptions', element: <SubscriptionsPage /> },
      { path: 'two', element: <PageTwo /> },
      { path: 'refund-requests', element: <RefundRequestsPage /> },
      { path: 'banner', element: <BannerPage /> },
      { path: 'three', element: <PageThree /> },
      {
        path: 'group',
        children: [
          { element: <PageFour />, index: true },
          { path: 'five', element: <PageFive /> },
          { path: 'six', element: <PageSix /> },
        ],
      },
    ],
  },
];
