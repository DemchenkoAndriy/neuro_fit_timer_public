import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
}

export function AppHeader({ title, subtitle, left, right }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__side">{left}</div>
      <div className="app-header__center">
        <h1 className="app-header__title">{title}</h1>
        {subtitle && <p className="app-header__subtitle">{subtitle}</p>}
      </div>
      <div className="app-header__side app-header__side--right">{right}</div>
    </header>
  );
}
