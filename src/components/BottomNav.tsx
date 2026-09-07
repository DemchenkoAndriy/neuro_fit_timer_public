import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Головна', icon: 'home' },
  { to: '/plan', label: 'План', icon: 'calendar' },
  { to: '/nutrition', label: 'Харчування', icon: 'meal' },
  { to: '/profile', label: 'Профіль', icon: 'user' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Основна навігація">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
        >
          <Icon name={tab.icon} size={24} />
          <span className="nav-item__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
