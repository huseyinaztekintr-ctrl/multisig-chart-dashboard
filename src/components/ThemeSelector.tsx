import { useState } from 'react';
import { ChevronDown, Check, Palette } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export const ThemeSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme, themes } = useTheme();

  const currentTheme = themes.find(t => t.value === theme);

  return (
    <div className="dropdown dropdown-end">
      {/* Theme selector button using DaisyUI classes */}
      <div 
        tabIndex={0} 
        role="button" 
        className="btn btn-ghost btn-sm gap-1.5 text-xs normal-case"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Palette className="w-3 h-3" />
        <span className="max-w-20 truncate">{currentTheme?.label || 'Theme'}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </div>
      
      {/* Dropdown content */}
      <ul 
        tabIndex={0} 
        className={`dropdown-content z-[1000] menu p-3 shadow-2xl bg-base-200 rounded-box w-56 max-h-72 overflow-y-auto border border-base-300 mt-1 ${
          isOpen ? 'block' : 'hidden'
        }`}
      >
        <li className="mb-2">
          <div className="text-base-content/70 text-xs font-semibold px-2 py-1 cursor-default">
            🎨 TEMA SEÇİMİ
          </div>
        </li>
        
        {themes.map((themeOption) => (
          <li key={themeOption.value}>
            <button
              onClick={() => {
                setTheme(themeOption.value);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 w-full text-left ${
                theme === themeOption.value 
                  ? 'bg-primary text-primary-content font-medium' 
                  : 'hover:bg-base-300 text-base-content'
              }`}
            >
              <span className="text-sm">{themeOption.label}</span>
              {theme === themeOption.value && (
                <Check className="w-4 h-4" />
              )}
            </button>
          </li>
        ))}
        
        <li className="mt-2 pt-2 border-t border-base-300">
          <div className="text-base-content/50 text-xs px-2 py-1 cursor-default">
            💡 Tema değişikliği tüm sayfayı etkiler
          </div>
        </li>
      </ul>
    </div>
  );
};