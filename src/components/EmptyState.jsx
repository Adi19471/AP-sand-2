import { Inbox } from 'lucide-react';

/**
 * Professional empty state - shown whenever a query legitimately returns
 * nothing, so the operator never faces a blank panel.
 */
const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nothing to show yet',
  message = '',
  action = null,
}) => (
  <div className="empty-state">
    <span className="empty-state__icon">
      <Icon size={26} />
    </span>
    <p className="empty-state__title">{title}</p>
    {message && <p className="empty-state__message">{message}</p>}
    {action && <div className="empty-state__action">{action}</div>}
  </div>
);

export default EmptyState;
