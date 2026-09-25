export default function Header({ customer }) {
  const lastLogin = new Date(Date.now() - 26 * 3600 * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const initials = customer?.fullName.split(' ').map((p) => p[0]).join('') ?? '';

  return (
    <header className="topbar">
      <div className="brand">
        <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#fff" />
          <path d="M6 20 Q16 6 26 20" stroke="#f7a823" strokeWidth="3" fill="none" />
          <rect x="6" y="22" width="20" height="3" fill="#0b3d91" />
        </svg>
        <div>
          <div className="brand-name">Horizon Bank</div>
          <div className="brand-sub">Personal Net Banking</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="secure">🔒 Secure session</div>
        <div className="user">
          <div className="avatar">{initials}</div>
          <div>
            <div className="user-name">Welcome, {customer?.fullName ?? '…'}</div>
            <div className="user-sub">Last login: {lastLogin}</div>
          </div>
        </div>
        <button className="btn-logout" type="button">Logout</button>
      </div>
    </header>
  );
}
