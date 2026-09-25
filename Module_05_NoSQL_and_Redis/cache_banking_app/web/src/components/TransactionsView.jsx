import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtDate, fmtTime, inr, mask, typeLabel } from '../api.js';
import CacheBadge from './CacheBadge.jsx';

const FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'CREDIT', label: 'Credits' },
  { id: 'DEBIT', label: 'Debits' },
];

export default function TransactionsView({ accountNo, account, onLoaded }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.transactions(accountNo);
      setRows(res.data);
      setMeta(res);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      onLoaded();
    }
  }, [accountNo, onLoaded]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((r) =>
    (filter === 'ALL' || r.type === filter)
    && (!search || `${r.description} ${r.reference}`.toLowerCase().includes(search.toLowerCase()))),
  [rows, filter, search]);

  const credits = shown.filter((r) => r.type === 'CREDIT').reduce((s, r) => s + r.amount, 0);
  const debits = shown.filter((r) => r.type === 'DEBIT').reduce((s, r) => s + r.amount, 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Account Statement</h2>
          <div className="muted">
            {account ? `${typeLabel[account.accountType]} · ${mask(accountNo)} · ${account.branch}` : accountNo}
          </div>
        </div>
        <div className="head-actions">
          <CacheBadge meta={meta} />
          <button type="button" className="btn-ghost" onClick={load} disabled={loading}>↻ Enquire again</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="search"
          placeholder="Search description or reference no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="totals">
          <span className="cr">Cr {inr(credits)}</span>
          <span className="dr">Dr {inr(debits)}</span>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap">
        <table className="txn-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Ref. No.</th>
              <th className="num">Withdrawal (Dr)</th>
              <th className="num">Deposit (Cr)</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan="6" className="empty">Loading transactions…</td></tr>
            )}
            {!loading && shown.length === 0 && (
              <tr><td colSpan="6" className="empty">No transactions match your filter.</td></tr>
            )}
            {shown.map((t) => (
              <tr key={t.txnId}>
                <td>
                  <div>{fmtDate(t.createdAt)}</div>
                  <div className="muted small">{fmtTime(t.createdAt)}</div>
                </td>
                <td>
                  <span className={`chip ch-${t.channel.toLowerCase()}`}>{t.channel}</span>
                  {t.description}
                </td>
                <td className="mono small">{t.reference}</td>
                <td className="num dr">{t.type === 'DEBIT' ? inr(t.amount) : ''}</td>
                <td className="num cr">{t.type === 'CREDIT' ? inr(t.amount) : ''}</td>
                <td className="num">{inr(t.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted small foot-note">
        Showing the latest {rows.length} transactions. Cached in Redis as <code>{meta?.key}</code>.
      </div>
    </section>
  );
}
