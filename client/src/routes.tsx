import type { ComponentType } from 'react';
import type { Role } from './lib/auth';
import {
  HomeIcon,
  CubeIcon,
  ShoppingBagIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  TruckIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UsersIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

import { LandingPage }     from './features/landing/LandingPage';
import { DashboardPage }    from './features/reports/DashboardPage';
import { LoginPage }        from './features/auth/LoginPage';
import { TrackPage }        from './features/track/TrackPage';
import { OrdersPage }       from './features/orders/OrdersPage';
import { NewOrderPage }     from './features/orders/NewOrderPage';
import { OrderDetailPage }  from './features/orders/OrderDetailPage';
import { StaffPage }        from './features/staff/StaffPage';
import { Placeholder }      from './components/ui/Placeholder';

import { StockPage }         from './features/stock/StockPage';
import { ReceiptPage }       from './features/stock/ReceiptPage';
import { MasterListPage }    from './features/masters/MasterListPage';
import { BoardPage }         from './features/floor/BoardPage';
import { LogPage }           from './features/floor/LogPage';
import { QcPage }            from './features/qc/QcPage';
import { DispatchPage }      from './features/dispatch/DispatchPage';
import { InvoicesPage }      from './features/dispatch/InvoicesPage';
import { InvoicePage }       from './features/dispatch/InvoicePage';
import { AttendancePage }    from './features/attendance/AttendancePage';
import { MonthEndPage }      from './features/reports/MonthEndPage';

export interface RouteConfig {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** 'all' means every authenticated role can access it */
  roles: Role[] | 'all';
  /** whether to show this route in the sidebar navigation */
  nav: boolean;
  element: JSX.Element;
  /** is this a P1 feature (still wired but labelled) */
  p1?: boolean;
}

export const ROUTES: RouteConfig[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: HomeIcon,
    roles: 'all',
    nav: true,
    element: <DashboardPage />,
  },
  {
    path: '/stock',
    label: 'Yarn Stock',
    icon: CubeIcon,
    roles: 'all',
    nav: true,
    element: <StockPage />,
  },
  {
    path: '/stock/receipt',
    label: 'Stock Receipt',
    icon: CubeIcon,
    roles: ['OWNER', 'SUPERVISOR'],
    nav: false,
    element: <ReceiptPage />,
  },
  {
    path: '/masters',
    label: 'Masters',
    icon: UsersIcon,
    roles: 'all',
    nav: true,
    element: <MasterListPage />,
  },
  {
    path: '/masters/:type',
    label: 'Masters',
    icon: UsersIcon,
    roles: 'all',
    nav: false,
    element: <MasterListPage />,
  },
  {
    path: '/staff',
    label: 'Staff Management',
    icon: UserGroupIcon,
    roles: ['OWNER', 'OFFICE'],
    nav: true,
    element: <StaffPage />,
  },
  {
    path: '/orders',
    label: 'Orders',
    icon: ShoppingBagIcon,
    roles: 'all',
    nav: true,
    element: <OrdersPage />,
  },
  {
    path: '/orders/new',
    label: 'New Order',
    icon: ShoppingBagIcon,
    roles: 'all',
    nav: false,
    element: <NewOrderPage />,
  },
  {
    path: '/orders/:id',
    label: 'Order Detail',
    icon: ShoppingBagIcon,
    roles: 'all',
    nav: false,
    element: <OrderDetailPage />,
  },
  {
    path: '/floor',
    label: 'Machine Floor',
    icon: WrenchScrewdriverIcon,
    roles: ['OWNER', 'SUPERVISOR', 'STAFF'],
    nav: true,
    element: <BoardPage />,
  },
  {
    path: '/floor/log',
    label: 'Production Log',
    icon: ClipboardDocumentListIcon,
    roles: ['OWNER', 'SUPERVISOR'],
    nav: false,
    element: <LogPage />,
  },
  {
    path: '/qc',
    label: 'Quality Control',
    icon: BeakerIcon,
    roles: ['OWNER', 'SUPERVISOR'],
    nav: true,
    element: <QcPage />,
  },
  {
    path: '/dispatch',
    label: 'Dispatch',
    icon: TruckIcon,
    roles: ['OWNER', 'SUPERVISOR'],
    nav: true,
    element: <DispatchPage />,
  },
  {
    path: '/invoices',
    label: 'Invoices',
    icon: DocumentTextIcon,
    roles: ['OWNER', 'OFFICE', 'SUPERVISOR'],
    nav: true,
    element: <InvoicesPage />,
  },
  {
    path: '/invoices/:id',
    label: 'Invoice',
    icon: DocumentTextIcon,
    roles: ['OWNER', 'OFFICE', 'SUPERVISOR'],
    nav: false,
    element: <InvoicePage />,
  },
  {
    path: '/attendance',
    label: 'Attendance',
    icon: ClipboardDocumentListIcon,
    roles: ['OWNER', 'OFFICE', 'SUPERVISOR', 'STAFF'],
    nav: true,
    element: <AttendancePage />,
  },
  {
    path: '/reports/month-end',
    label: 'Month-End',
    icon: ChartBarIcon,
    roles: ['OWNER', 'OFFICE'],
    nav: true,
    element: <MonthEndPage />,
  },
  {
    path: '/reports/defects',
    label: 'Defects',
    icon: ChartBarIcon,
    roles: ['OWNER'],
    nav: true,
    p1: true,
    element: <Placeholder title="Defects Report" description="Defect % by machine and type — P1, coming in Phase 6." />,
  },
  {
    path: '/rolls/:id',
    label: 'Roll Trace',
    icon: BeakerIcon,
    roles: ['OWNER', 'SUPERVISOR'],
    nav: false,
    p1: true,
    element: <Placeholder title="Roll Trace" description="Full traceability timeline — P1, coming in Phase 6." />,
  },
  {
    path: '/rolls/:id/label',
    label: 'Roll Label',
    icon: BeakerIcon,
    roles: 'all',
    nav: false,
    p1: true,
    element: <Placeholder title="Roll Label" description="Printable QR label — P1, coming in Phase 6." />,
  },
];

// Public-only routes (no AppLayout, no auth)
export const PUBLIC_ROUTES = [
  { path: '/',                element: <LandingPage /> },
  { path: '/login',           element: <LoginPage /> },
  { path: '/track/:token',    element: <TrackPage /> },
];
