import { RouterProvider } from 'react-router-dom';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { PwaPrompts } from '@/components/pwa/update-prompt';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { router } from '@/router';

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryProvider>
          <RouterProvider router={router} />
          <OfflineIndicator />
          <PwaPrompts />
        </QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
