import { memo } from 'react';
import { SkeletonBlock } from './Loading';
import { formatNumber } from '../utils/format';

/**
 * Dashboard metric tile. Memoised because the dashboard re-renders on every
 * counter push and most tiles will not have changed.
 */
const StatCard = ({
  icon: Icon,
  label,
  value,
  suffix = '',
  hint = '',
  tone = 'amber',
  loading = false,
  decimals = 0,
  onClick,
}) => {
  const content = (
    <>
      {Icon && (
        <span className="stat-card__icon">
          <Icon size={21} />
        </span>
      )}
      <div className="stat-card__body">
        <p className="stat-card__label">{label}</p>
        {loading ? (
          <SkeletonBlock height={26} width="66%" />
        ) : (
          <p className="stat-card__value">
            {typeof value === 'number' ? formatNumber(value, decimals) : value}
            {suffix && <small>{suffix}</small>}
          </p>
        )}
        {hint && !loading && <p className="stat-card__meta">{hint}</p>}
      </div>
    </>
  );

  const className = `stat-card stat-card--tone-${tone}`;

  if (onClick) {
    return (
      <button type="button" className={`${className} cursor-pointer text-left`} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
};

export default memo(StatCard);
