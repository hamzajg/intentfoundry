import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Spinner, ToastProvider } from './components/ui';
import { useAuthStore } from './stores';
import { authApi } from './api/client';

const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })));
const Overview = lazy(() => import('./pages/Overview').then((m) => ({ default: m.Overview })));
const Intent = lazy(() => import('./pages/Intent').then((m) => ({ default: m.Intent })));
const Architecture = lazy(() => import('./pages/Architecture').then((m) => ({ default: m.Architecture })));
const Loop = lazy(() => import('./pages/Loop').then((m) => ({ default: m.Loop })));
const Telemetry = lazy(() => import('./pages/Telemetry').then((m) => ({ default: m.Telemetry })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

function ProtectedLayout() {
  const { token, setUser, user } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      authApi.me()
        .then((res) => setUser(res.data))
        .catch(() => useAuthStore.getState().logout());
    }
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="flex items-center justify-center h-screen bg-foundry-950">
            <Spinner size="lg" />
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route element={<ProtectedLayout />}>
              <Route element={<AppShell><Outlet /></AppShell>}>
                <Route path="/projects" element={<Projects />} />
                <Route path="/overview" element={<Overview />} />
                <Route path="/intent" element={<Intent />} />
                <Route path="/architecture" element={<Architecture />} />
                <Route path="/loop" element={<Loop />} />
                <Route path="/telemetry" element={<Telemetry />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;