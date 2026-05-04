import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useEventStore, useProjectStore, useSprintStore } from '../stores';
import { Badge } from './ui';

const NAV_ITEMS = [
  { path: '/overview', label: 'Overview', icon: '◈' },
  { path: '/intent', label: 'Intent', icon: '◎' },
  { path: '/architecture', label: 'Architecture', icon: '⚙' },
  { path: '/loop', label: 'Loop', icon: '⟳' },
  { path: '/telemetry', label: 'Telemetry', icon: '▦' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { activeProject } = useProjectStore();
  const { activeSprint } = useSprintStore();
  const { sseConnected } = useEventStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStageBadge = () => {
    if (!activeSprint) return null;
    const stageColors: Record<string, 'amber' | 'success' | 'info'> = {
      intent: 'amber',
      plan: 'info',
      execute: 'amber',
      validate: 'info',
      reflect: 'success',
    };
    return <Badge variant={stageColors[activeSprint.current_stage]}>{activeSprint.current_stage}</Badge>;
  };

  return (
    <div className="flex h-screen bg-foundry-950">
      <aside className="w-56 flex flex-col border-r border-foundry-600 bg-foundry-900">
        <div className="p-4 border-b border-foundry-600">
          <Link to="/" className="flex items-center gap-2">
            <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="font-mono font-semibold text-foundry-50 tracking-tight">INTENT</span>
          </Link>
        </div>

        <nav className="flex-1 p-2">
          {activeProject && (
            <div className="px-3 py-2 mb-4">
              <div className="text-xs font-mono text-foundry-400 uppercase tracking-wider">Active Project</div>
              <div className="text-sm font-medium text-foundry-100 truncate">{activeProject.name}</div>
            </div>
          )}
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? 'bg-foundry-800 text-amber-400 border-l-2 border-amber-500'
                      : 'text-foundry-300 hover:text-foundry-100 hover:bg-foundry-800'
                  }`
                }
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-foundry-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-foundry-400">SSE</span>
            <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>
          {activeSprint && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-foundry-400">Sprint</span>
              {getStageBadge()}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-foundry-400 truncate">{user?.email}</span>
            <button onClick={handleLogout} className="ml-auto text-xs text-foundry-400 hover:text-foundry-100">
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 flex items-center justify-between px-6 border-b border-foundry-600 bg-foundry-900">
          <div className="flex items-center gap-4">
            <span className="text-sm font-mono text-foundry-300 uppercase tracking-wider">IntentFoundry</span>
            <span className="text-foundry-500">/</span>
            <span className="text-sm text-foundry-200">{location.pathname.split('/')[1] || 'overview'}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/projects" className="text-sm text-amber-400 hover:text-amber-300">
              Switch Project
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}