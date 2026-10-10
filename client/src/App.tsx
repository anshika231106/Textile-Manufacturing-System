import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui/Toast';
import { RequireRole } from './components/layout/RequireRole';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { ROUTES, PUBLIC_ROUTES } from './routes';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public routes — no auth, no AppLayout */}
              {PUBLIC_ROUTES.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}

              {/* Authenticated routes — wrapped in RequireRole + AppLayout */}
              {ROUTES.map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={
                    <RequireRole roles={r.roles}>
                      <AppLayout pageTitle={r.label}>
                        {r.element}
                      </AppLayout>
                    </RequireRole>
                  }
                />
              ))}

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
