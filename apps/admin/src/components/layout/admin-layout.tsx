import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden p-6">
          <div className="min-w-0 break-words">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
