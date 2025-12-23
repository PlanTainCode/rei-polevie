import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Leaf,
  LayoutDashboard,
  Building2,
  FileText,
  ClipboardList,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const navigation = [
  { name: 'Главная', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Компания', href: '/company', icon: Building2 },
  { name: 'Объекты', href: '/projects', icon: FileText },
  { name: 'ТЗ', href: '/technical-tasks', icon: ClipboardList, beta: true },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 
          bg-[var(--bg-secondary)] border-r border-[var(--border-color)]
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary-400" />
              </div>
              <span className="text-lg font-semibold">Полевие</span>
            </div>
            <button
              className="lg:hidden p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
                {item.beta && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-amber-500/20 text-amber-400 rounded">
                    beta
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-[var(--border-color)]">
            <div className="relative">
              <button
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-9 h-9 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-400" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {user?.companyName || 'Без компании'}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 py-1 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] shadow-lg">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Выйти</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Mobile header */}
        <header className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <button
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary-400" />
            </div>
            <span className="font-semibold">Полевие</span>
          </div>
          <div className="w-9" /> {/* Spacer */}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

