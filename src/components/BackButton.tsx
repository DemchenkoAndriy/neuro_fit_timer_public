import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      aria-label="Назад"
    >
      <Icon name="chevronLeft" size={22} />
    </button>
  );
}
