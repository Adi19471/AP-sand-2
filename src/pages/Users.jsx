import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Hourglass,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import GoogleMark from '../components/GoogleMark';
import GrantAccessDialog from '../components/GrantAccessDialog';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { isAdminEmail } from '../firebase/firebaseConfig';
import {
  approveUser,
  grantAccess,
  revokeAccess,
  setAccessRole,
  setUserRole,
  setUserStatus,
  subscribeAccessList,
  subscribeUsers,
} from '../services/userService';
import { ROLE_LABELS, ROLES, USER_STATUS, USER_STATUS_LABELS } from '../utils/constants';
import { formatDate, formatDateTime, relativeTime } from '../utils/dateUtils';
import { formatNumber, initials, maskMobile } from '../utils/format';
import { friendlyError } from '../utils/errors';

/**
 * Shown for an e-mail an administrator approved in advance whose Google
 * account has not signed in yet. It is a row state, not a stored status.
 */
const INVITED = 'INVITED';
const GOOGLE_PROVIDER_ID = 'google.com';

const RoleBadge = ({ role }) =>
  role === ROLES.ADMIN ? (
    <span className="badge badge--admin">
      <ShieldCheck size={11} />
      {ROLE_LABELS.ADMIN}
    </span>
  ) : (
    <span className="badge badge--user">
      <User size={11} />
      {ROLE_LABELS.USER}
    </span>
  );

const StatusBadge = ({ status }) => {
  if (status === USER_STATUS.DISABLED) {
    return <span className="badge badge--disabled">{USER_STATUS_LABELS.DISABLED}</span>;
  }
  if (status === USER_STATUS.PENDING) {
    return <span className="badge badge--pending">{USER_STATUS_LABELS.PENDING}</span>;
  }
  if (status === INVITED) return <span className="badge badge--invited">Not signed in yet</span>;
  return <span className="badge badge--active">{USER_STATUS_LABELS.ACTIVE}</span>;
};

/** Pending first - they need a decision - then approvals not used yet. */
const ATTENTION_ORDER = { [USER_STATUS.PENDING]: 0, [INVITED]: 1 };
const attention = (row) => ATTENTION_ORDER[row.status] ?? 2;

/**
 * Users & Access: every Google account that can - or has asked to - use the
 * system, its role and whether it may sign in. An administrator approves an
 * account here, either after it has signed in or in advance by its e-mail.
 * Changes are enforced server-side by the Firestore rules.
 */
const Users = () => {
  const { actor } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // { row, kind: 'role'|'status'|'approve'|'revoke', value }
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (rows) => {
        setUsers(rows);
        setLoading(false);
      },
      (err) => {
        setError(friendlyError(err, 'Unable to load users.'));
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(
    () =>
      subscribeAccessList(setInvites, (err) =>
        setError(friendlyError(err, 'Unable to load the approved Google accounts.')),
      ),
    [],
  );

  /** Accounts, plus the approvals whose Google account has not signed in yet. */
  const directory = useMemo(() => {
    const known = new Set(users.map((u) => String(u.email || '').toLowerCase()));
    const waiting = invites
      .filter((entry) => !known.has(String(entry.email || '').toLowerCase()))
      .map((entry) => ({
        ...entry,
        id: `invite:${entry.email}`,
        isInvite: true,
        status: INVITED,
      }));
    return [...users, ...waiting].sort((a, b) => attention(a) - attention(b));
  }, [users, invites]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === USER_STATUS.ACTIVE).length,
      pending: users.filter((u) => u.status === USER_STATUS.PENDING).length,
      inactive: users.filter((u) => u.status === USER_STATUS.DISABLED).length,
      invited: directory.filter((row) => row.isInvite).length,
      admins: users.filter((u) => u.role === ROLES.ADMIN).length,
    }),
    [users, directory],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return directory.filter((row) => {
      if (roleFilter && row.role !== roleFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (!term) return true;
      return [row.name, row.email, row.mobile].some((v) =>
        String(v || '').toLowerCase().includes(term),
      );
    });
  }, [directory, search, roleFilter, statusFilter]);

  const isSelf = (row) => row.id === actor?.uid;
  /** The signed-in administrator and the permanent administrators cannot be changed here. */
  const isLocked = (row) => !row.isInvite && (isSelf(row) || isAdminEmail(row.email));

  /** A role change on an approval that is not in use yet needs no confirmation. */
  const changeInviteRole = async (row, role) => {
    try {
      await setAccessRole(row, role, actor);
      toast.success(`${row.email} will sign in as ${ROLE_LABELS[role]}.`);
    } catch (err) {
      toast.error(friendlyError(err, 'Unable to change the role.'));
    }
  };

  const confirm = async () => {
    const { row, kind, value } = pending;
    setBusy(true);
    try {
      if (kind === 'role') {
        await setUserRole(row, value, actor);
        toast.success(`${row.email} is now ${ROLE_LABELS[value]}.`);
      } else if (kind === 'approve') {
        await approveUser(row, row.role || ROLES.USER, actor);
        toast.success(`${row.email} approved as ${ROLE_LABELS[row.role || ROLES.USER]}.`);
      } else if (kind === 'revoke') {
        await revokeAccess(row, actor);
        toast.success(`Approval for ${row.email} removed.`);
      } else {
        await setUserStatus(row, value, actor);
        toast.success(
          `${row.email} ${value === USER_STATUS.DISABLED ? 'can no longer sign in' : 'can sign in again'}.`,
        );
      }
      setPending(null);
    } catch (err) {
      toast.error(friendlyError(err, 'Unable to update this user.'));
    } finally {
      setBusy(false);
    }
  };

  const openGrant = () => {
    setGrantError('');
    setGranting(true);
  };

  /** Approve a Google account by e-mail, from the "Add Google Account" form. */
  const handleGrant = async ({ email, name, role }) => {
    setGrantError('');

    const account = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (account && account.status !== USER_STATUS.PENDING) {
      setGrantError(
        account.status === USER_STATUS.DISABLED
          ? `${email} already has an account, and it is inactive. Use Enable in the list to restore it.`
          : `${email} already has access.`,
      );
      return;
    }

    setGrantBusy(true);
    try {
      if (account) {
        // Already signed in and waiting: this is the approval.
        await approveUser(account, role, actor);
        toast.success(`${email} approved as ${ROLE_LABELS[role]}.`);
      } else {
        await grantAccess({ email, name, role }, actor);
        toast.success(`${email} can now sign in with Google as ${ROLE_LABELS[role]}.`);
      }
      setGranting(false);
    } catch (err) {
      setGrantError(friendlyError(err, 'Unable to approve this Google account.'));
    } finally {
      setGrantBusy(false);
    }
  };

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (row) => (
        <div className="flex min-w-[220px] items-center gap-3">
          {row.photoURL ? (
            <img
              src={row.photoURL}
              alt=""
              className="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className={`avatar size-9 ${row.isInvite ? 'avatar--muted' : ''}`}>
              {initials(row.name, row.email)}
            </span>
          )}
          <div className="cell-stack">
            <span className="cell-stack__main">
              {row.name || '-'} {isSelf(row) && <span className="badge badge--neutral">You</span>}
            </span>
            <span className="cell-stack__sub wrap-anywhere">{row.email}</span>
            {row.mobile && <span className="cell-stack__sub">{maskMobile(row.mobile)}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'google',
      label: 'Google Account',
      render: (row) => {
        if (row.isInvite) {
          return (
            <div className="cell-stack">
              <span className="cell-stack__main flex items-center gap-1.5 font-medium text-slate-500">
                <GoogleMark size={14} className="opacity-50 grayscale" />
                Not linked yet
              </span>
              <span className="cell-stack__sub">Approved {formatDate(row.addedAt)}</span>
            </div>
          );
        }
        const linked = row.provider === GOOGLE_PROVIDER_ID;
        return (
          <div className="cell-stack">
            <span
              className={`cell-stack__main flex items-center gap-1.5${linked ? '' : ' font-medium text-slate-500'}`}
            >
              <GoogleMark size={14} className={linked ? '' : 'opacity-50 grayscale'} />
              {linked ? 'Linked' : 'Not linked yet'}
            </span>
            <span className="cell-stack__sub">
              {linked ? `Since ${formatDate(row.createdAt)}` : 'Links on next Google sign-in'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => {
        const permanent = !row.isInvite && isAdminEmail(row.email);
        return (
          <div className="cell-stack">
            {isLocked(row) ? (
              <RoleBadge role={row.role} />
            ) : (
              <select
                className="select h-9 w-auto pr-8 pl-2.5 text-[13px]"
                aria-label={`Role for ${row.email}`}
                value={row.role || ROLES.USER}
                onChange={(event) =>
                  row.isInvite
                    ? changeInviteRole(row, event.target.value)
                    : setPending({ row, kind: 'role', value: event.target.value })
                }
              >
                <option value={ROLES.USER}>{ROLE_LABELS.USER}</option>
                <option value={ROLES.ADMIN}>{ROLE_LABELS.ADMIN}</option>
              </select>
            )}
            {permanent && <span className="cell-stack__sub">Permanent admin</span>}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <div className="cell-stack items-start">
          <StatusBadge status={row.status} />
          {(row.approvedByEmail || row.addedByEmail) && (
            <span className="cell-stack__sub wrap-anywhere">
              Approved by {row.approvedByEmail || row.addedByEmail}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-stack__main whitespace-nowrap">
            {row.lastLoginAt ? relativeTime(row.lastLoginAt) : 'Never'}
          </span>
          {row.lastLoginAt && (
            <span className="cell-stack__sub">
              {formatDateTime(row.lastLoginAt)} &middot; {formatNumber(row.loginCount || 0)}{' '}
              {row.loginCount === 1 ? 'login' : 'logins'}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'cell-actions text-right',
      hideOnCard: true,
      render: (row) => <div className="flex justify-end gap-1.5">{rowActions(row)}</div>,
    },
  ];

  function rowActions(row) {
    if (row.isInvite) {
      return (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setPending({ row, kind: 'revoke' })}
        >
          <Trash2 size={14} />
          Remove
        </button>
      );
    }

    if (isLocked(row)) return null;

    if (row.status === USER_STATUS.PENDING) {
      return (
        <>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setPending({ row, kind: 'approve' })}
          >
            <UserCheck size={14} />
            Approve
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setPending({ row, kind: 'status', value: USER_STATUS.DISABLED })}
          >
            <X size={14} />
            Reject
          </button>
        </>
      );
    }

    const disabled = row.status === USER_STATUS.DISABLED;
    return (
      <button
        type="button"
        className={`btn btn--sm ${disabled ? 'btn--outline' : 'btn--ghost'}`}
        onClick={() =>
          setPending({
            row,
            kind: 'status',
            value: disabled ? USER_STATUS.ACTIVE : USER_STATUS.DISABLED,
          })
        }
      >
        {disabled ? <CheckCircle2 size={14} /> : <Ban size={14} />}
        {disabled ? 'Enable' : 'Disable'}
      </button>
    );
  }

  const dialogCopy = (() => {
    if (!pending) return {};
    const { row, kind, value } = pending;
    if (kind === 'role') {
      return value === ROLES.ADMIN
        ? {
            tone: 'warning',
            title: `Make ${row.email} an Administrator?`,
            message:
              'Administrators see every receipt, can cancel and delete receipts, manage users and change settings.',
            label: 'Make Administrator',
          }
        : {
            tone: 'warning',
            title: `Change ${row.email} to Operator?`,
            message: 'Operators can generate receipts and see only their own receipts.',
            label: 'Make Operator',
          };
    }
    if (kind === 'approve') {
      return {
        tone: 'info',
        title: `Approve ${row.email}?`,
        message: `This Google account will be able to sign in as ${ROLE_LABELS[row.role || ROLES.USER]}. Change the role in the list first if it should be different.`,
        label: 'Approve Account',
      };
    }
    if (kind === 'revoke') {
      return {
        tone: 'warning',
        title: `Remove the approval for ${row.email}?`,
        message:
          'This Google account has not signed in yet. If it signs in after this, it will wait for approval like any new account.',
        label: 'Remove Approval',
      };
    }
    if (value === USER_STATUS.DISABLED) {
      return row.status === USER_STATUS.PENDING
        ? {
            tone: 'danger',
            title: `Reject ${row.email}?`,
            message:
              'The account is marked inactive and cannot sign in. You can enable it later from this list.',
            label: 'Reject Account',
          }
        : {
            tone: 'danger',
            title: `Disable ${row.email}?`,
            message: 'They are signed out immediately and cannot sign in or generate receipts.',
            label: 'Disable Account',
          };
    }
    return {
      tone: 'info',
      title: `Enable ${row.email}?`,
      message: 'They will be able to sign in and generate receipts again.',
      label: 'Enable Account',
    };
  })();

  const filtered = Boolean(search || roleFilter || statusFilter);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="breadcrumb">Administration</p>
          <h1 className="page-title">Users &amp; Access</h1>
          <p className="page-subtitle">
            Approve Google accounts, assign Administrator or Operator roles and disable access. A
            new Google account appears here, waiting for approval, as soon as it signs in.
          </p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn--primary" onClick={openGrant}>
            <UserPlus size={16} />
            Add Google Account
          </button>
        </div>
      </div>

      {counts.pending > 0 && statusFilter !== USER_STATUS.PENDING && (
        <div className="alert alert--warning mb-4 items-center" role="status">
          <Hourglass size={17} className="shrink-0" />
          <div className="alert__body flex-1">
            <strong className="font-semibold">
              {formatNumber(counts.pending)} Google {counts.pending === 1 ? 'account is' : 'accounts are'}{' '}
              waiting for approval.
            </strong>{' '}
            They have signed in but cannot open the app yet.
          </div>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => setStatusFilter(USER_STATUS.PENDING)}
          >
            Review
          </button>
        </div>
      )}

      <div className="kpi-strip">
        <div className="kpi">
          <p className="kpi__label">Total Users</p>
          <p className="kpi__value">{formatNumber(counts.total)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Active</p>
          <p className="kpi__value">{formatNumber(counts.active)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Pending Approval</p>
          <p className="kpi__value">{formatNumber(counts.pending)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Inactive</p>
          <p className="kpi__value">{formatNumber(counts.inactive)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Not Signed In Yet</p>
          <p className="kpi__value">{formatNumber(counts.invited)}</p>
        </div>
        <div className="kpi">
          <p className="kpi__label">Administrators</p>
          <p className="kpi__value">{formatNumber(counts.admins)}</p>
        </div>
      </div>

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Name, email or mobile…" ariaLabel="Search users" delay={150} />
        <label className="filter-select">
          <span className="sr-only">Role</span>
          <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            <option value={ROLES.ADMIN}>{ROLE_LABELS.ADMIN}</option>
            <option value={ROLES.USER}>{ROLE_LABELS.USER}</option>
          </select>
        </label>
        <label className="filter-select">
          <span className="sr-only">Status</span>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value={USER_STATUS.ACTIVE}>{USER_STATUS_LABELS.ACTIVE}</option>
            <option value={USER_STATUS.PENDING}>{USER_STATUS_LABELS.PENDING}</option>
            <option value={USER_STATUS.DISABLED}>{USER_STATUS_LABELS.DISABLED}</option>
            <option value={INVITED}>Not signed in yet</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="alert alert--error my-3" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyIcon={UsersIcon}
        emptyTitle="No users found"
        emptyMessage={
          filtered
            ? 'Try a different search or filter.'
            : 'Add a Google account to give someone access.'
        }
        cardTitle={(row) => row.name || row.email}
        cardBadge={(row) => <StatusBadge status={row.status} />}
        cardActions={(row) => rowActions(row)}
        minWidth={980}
      />

      <GrantAccessDialog
        open={granting}
        busy={grantBusy}
        error={grantError}
        onSubmit={handleGrant}
        onCancel={() => !grantBusy && setGranting(false)}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        tone={dialogCopy.tone}
        title={dialogCopy.title}
        message={dialogCopy.message}
        confirmLabel={dialogCopy.label}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => !busy && setPending(null)}
      />
    </>
  );
};

export default Users;
