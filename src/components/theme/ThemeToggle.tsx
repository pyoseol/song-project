import './ThemeToggle.css';
import { useThemeStore } from '../../store/themeStore';

export default function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isLight ? '다크 모드로 변경' : '화이트 모드로 변경'}
      aria-pressed={isLight}
      title={isLight ? '다크 모드' : '화이트 모드'}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isLight ? '☀' : '☾'}
      </span>
      <span className="theme-toggle-label">{isLight ? '화이트' : '다크'}</span>
      <span className={`theme-toggle-track${isLight ? ' is-light' : ''}`} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
