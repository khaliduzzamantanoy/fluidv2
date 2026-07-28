'use client';

import { useState } from 'react';
import { 
  BarChart3, Box, GitBranch, Globe, Activity, Settings, LogOut, 
  LayoutDashboard, Server, Shield, Bell, Terminal, ChevronLeft, 
  ChevronRight, Menu, X, Plus, ArrowUpRight, Clock, CheckCircle2, 
  AlertCircle, Loader2, LucideIcon, ExternalLink, RefreshCw
} from 'lucide-react';

import AuthPage from './AuthPage';
import DashboardHome from './DashboardHome';
import ProjectsPage from './ProjectsPage';
import ProjectDetail from './ProjectDetail';
import DomainPage from './DomainPage';
import ActivityPage from './ActivityPage';
import SettingsPage from './SettingsPage';

export type PageView = 'dashboard' | 'projects' | 'project-detail' | 'domains' | 'activity' | 'settings';

export default function AppShell({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageView>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  interface NavItem {
    icon: LucideIcon;
    label: string;
    view: PageView;
    badge?: string | number;
  }

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
    { icon: Box, label: 'Projects', view: 'projects' },
    { icon: Globe, label: 'Domains', view: 'domains' },
    { icon: Activity, label: 'Activity', view: 'activity' },
    { icon: Settings, label: 'Settings', view: 'settings' },
  ];

  const navigateTo = (view: PageView, projectId?: string) => {
    setCurrentPage(view);
    if (projectId) setSelectedProjectId(projectId);
    setMobileSidebar(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardHome user={user} onNavigate={navigateTo} />;
      case 'projects':
        return <ProjectsPage user={user} onNavigate={navigateTo} />;
      case 'project-detail':
        return <ProjectDetail projectId={selectedProjectId} user={user} onNavigate={navigateTo} />;
      case 'domains':
        return <DomainPage user={user} />;
      case 'activity':
        return <ActivityPage user={user} />;
      case 'settings':
        return <SettingsPage user={user} onLogout={onLogout} />;
      default:
        return <DashboardHome user={user} onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 flex">
      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileSidebar(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-[#0c1222] border-r border-gray-800/80 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} ${mobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-brand-500/20">
              F
            </div>
            {!collapsed && (
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">FLUID</h2>
                <p className="text-[10px] text-gray-500">VPS Portal</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="hidden lg:block text-gray-500 hover:text-white transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="hidden lg:block text-gray-500 hover:text-white transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setMobileSidebar(false)} className="lg:hidden text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => navigateTo(item.view)}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentPage === item.view
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <item.icon className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`} />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* User info */}
        <div className="px-3 py-4 border-t border-gray-800/80">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center text-white text-xs font-bold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{user?.username}</p>
                <p className="text-[10px] text-gray-500 truncate">{user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#090d16]/95 backdrop-blur-md border-b border-gray-800/80 px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => setMobileSidebar(true)} className="lg:hidden text-gray-400 hover:text-white">
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center space-x-2 text-sm">
              <span className="text-gray-400">Pages</span>
              <span className="text-gray-600">/</span>
              <span className="text-white font-medium capitalize">{currentPage.replace('-', ' ')}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onLogout} className="flex items-center space-x-2 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}