import { inr, mask, typeLabel } from '../api.js';
import CacheBadge from './CacheBadge.jsx';

export default function AccountCards({ accounts, meta, selected, onSelect, onRefresh }) {
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>My Accounts</h2>
          <div className="muted">Total available balance <b className="total">{inr(total)}</b></div>
        </div>
        <div className="head-actions">
          <CacheBadge meta={meta} />
          <button type="button" className="btn-ghost" onClick={onRefresh}>↻ Refresh</button>
        </div>
      </div>
      <div className="acct-grid">
        {accounts.map((a) => (
          <button
            type="button"
            key={a.accountNo}
            className={`acct-card ${a.accountType.toLowerCase()} ${selected === a.accountNo ? 'selected' : ''}`}
            onClick={() => onSelect(a.accountNo)}
          >
            <div className="acct-type">{typeLabel[a.accountType]}</div>
            <div className="acct-no">{mask(a.accountNo)}</div>
            <div className="acct-bal-label">Available Balance</div>
            <div className="acct-bal">{inr(a.balance)}</div>
            <div className="acct-foot">
              <span>{a.branch}</span>
              <span>{a.ifsc}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
