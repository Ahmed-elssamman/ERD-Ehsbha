import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AdminQueryProvider } from './providers/query-provider';
import { ThemeProvider } from './providers/theme-provider';
import { I18nProvider } from './i18n/provider';
import { ToastViewport } from './components/ui/toast';
import { router } from './router';
import './globals.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AdminQueryProvider>
          <RouterProvider router={router} />
          <ToastViewport />
        </AdminQueryProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
