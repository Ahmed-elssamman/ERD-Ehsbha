import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: 'light' | 'dark' | 'system'; icon: typeof Sun; label: string }> = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];
  return (
    <div className="inline-flex items-center rounded-md border bg-card p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-sm transition-colors',
            theme === value
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
