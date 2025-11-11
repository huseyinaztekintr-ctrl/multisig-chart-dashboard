import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'main' | 'light' | 'dark' | 'cupcake' | 'bumblebee' | 'emerald' | 'corporate' | 'synthwave' | 'retro' | 'cyberpunk' | 'valentine' | 'halloween' | 'garden' | 'forest' | 'aqua' | 'lofi' | 'pastel' | 'fantasy' | 'wireframe' | 'black' | 'luxury' | 'dracula' | 'cmyk' | 'autumn' | 'business' | 'acid' | 'lemonade' | 'night' | 'coffee' | 'winter' | 'dim' | 'nord' | 'sunset';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: { value: Theme; label: string }[];
};

const initialState: ThemeProviderState = {
  theme: 'main',
  setTheme: () => null,
  themes: [],
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const DAISY_THEMES = [
  { value: 'main' as Theme, label: 'Main (Varsayılan)' },
  { value: 'light' as Theme, label: 'Light' },
  { value: 'dark' as Theme, label: 'Dark' },
  { value: 'cupcake' as Theme, label: 'Cupcake' },
  { value: 'bumblebee' as Theme, label: 'Bumblebee' },
  { value: 'emerald' as Theme, label: 'Emerald' },
  { value: 'corporate' as Theme, label: 'Corporate' },
  { value: 'synthwave' as Theme, label: 'Synthwave' },
  { value: 'retro' as Theme, label: 'Retro' },
  { value: 'cyberpunk' as Theme, label: 'Cyberpunk' },
  { value: 'valentine' as Theme, label: 'Valentine' },
  { value: 'halloween' as Theme, label: 'Halloween' },
  { value: 'garden' as Theme, label: 'Garden' },
  { value: 'forest' as Theme, label: 'Forest' },
  { value: 'aqua' as Theme, label: 'Aqua' },
  { value: 'lofi' as Theme, label: 'Lo-fi' },
  { value: 'pastel' as Theme, label: 'Pastel' },
  { value: 'fantasy' as Theme, label: 'Fantasy' },
  { value: 'wireframe' as Theme, label: 'Wireframe' },
  { value: 'black' as Theme, label: 'Black' },
  { value: 'luxury' as Theme, label: 'Luxury' },
  { value: 'dracula' as Theme, label: 'Dracula' },
  { value: 'cmyk' as Theme, label: 'CMYK' },
  { value: 'autumn' as Theme, label: 'Autumn' },
  { value: 'business' as Theme, label: 'Business' },
  { value: 'acid' as Theme, label: 'Acid' },
  { value: 'lemonade' as Theme, label: 'Lemonade' },
  { value: 'night' as Theme, label: 'Night' },
  { value: 'coffee' as Theme, label: 'Coffee' },
  { value: 'winter' as Theme, label: 'Winter' },
  { value: 'dim' as Theme, label: 'Dim' },
  { value: 'nord' as Theme, label: 'Nord' },
  { value: 'sunset' as Theme, label: 'Sunset' },
];

export function ThemeProvider({
  children,
  defaultTheme = 'main',
  storageKey = 'ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    // DaisyUI tema değiştirme yöntemi
    if (theme === 'main') {
      root.removeAttribute('data-theme');
      // Kendi custom temamızı kullan
      root.className = root.className.replace(/data-theme-\w+/g, '');
    } else {
      // DaisyUI temalarını kullan
      root.setAttribute('data-theme', theme);
    }

    console.log('Theme changed to:', theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
      console.log('Setting theme to:', theme);
    },
    themes: DAISY_THEMES,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};