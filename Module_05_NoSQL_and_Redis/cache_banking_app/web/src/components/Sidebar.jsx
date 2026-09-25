const MENU = [
  {
    group: 'Accounts',
    items: [{ id: 'transactions', icon: '📄', label: 'Transactions', hint: 'Account statement' }],
  },
  {
    group: 'Payments',
    items: [{ id: 'transfer', icon: '⇄', label: 'Fund Transfer', hint: 'Own & other accounts' }],
  },
];

export default function Sidebar({ view, onChange }) {
  return (
    <nav className="sidebar">
      {MENU.map((g) => (
        <div key={g.group} className="menu-group">
          <div className="menu-title">{g.group}</div>
          {g.items.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`menu-item ${view === m.id ? 'active' : ''}`}
              onClick={() => onChange(m.id)}
            >
              <span className="menu-icon">{m.icon}</span>
              <span>
                <span className="menu-label">{m.label}</span>
                <span className="menu-hint">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
      <div className="side-help">
        <div className="side-help-title">24×7 Customer Care</div>
        <div>1800 000 0000</div>
        <div className="muted">Never share your OTP or PIN.</div>
      </div>
    </nav>
  );
}
