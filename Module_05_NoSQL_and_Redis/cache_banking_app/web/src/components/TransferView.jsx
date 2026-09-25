import { useEffect, useState } from 'react';
import { api, inr, mask, typeLabel } from '../api.js';

const STEPS = ['Transfer details', 'Review & confirm', 'Acknowledgement'];
const EMPTY = { fromAccount: '', mode: 'own', toOwn: '', toOther: '', amount: '', remarks: '' };

export default function TransferView({ accounts, onDone, onViewStatement, onApi }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [payee, setPayee] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!form.fromAccount && accounts.length) {
      setForm((f) => ({ ...f, fromAccount: accounts[0].accountNo, toOwn: accounts[1]?.accountNo ?? '' }));
    }
  }, [accounts, form.fromAccount]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (k === 'toOther' || k === 'mode') setPayee(null);
    setError('');
  };

  const from = accounts.find((a) => a.accountNo === form.fromAccount);
  const toAccount = form.mode === 'own' ? form.toOwn : form.toOther.trim();
  const toLabel = form.mode === 'own'
    ? (() => { const a = accounts.find((x) => x.accountNo === form.toOwn); return a ? `${typeLabel[a.accountType]} · ${mask(a.accountNo)}` : ''; })()
    : payee ? `${payee.holderName} · ${mask(payee.accountNo)} · ${payee.ifsc}` : '';

  async function verifyPayee() {
    setBusy(true);
    try {
      setPayee(await api.lookup(form.toOther.trim()));
      setError('');
    } catch (e) {
      setPayee(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function review(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!toAccount) return setError('Choose the account to credit.');
    if (toAccount === form.fromAccount) return setError('From and To accounts must be different.');
    if (form.mode === 'other' && !payee) return setError('Verify the beneficiary account first.');
    if (!(amt > 0)) return setError('Enter a valid amount.');
    if (from && amt > from.balance) return setError(`Insufficient balance. Available: ${inr(from.balance)}`);
    setError('');
    return setStep(1);
  }

  async function confirm() {
    setBusy(true);
    try {
      const r = await api.transfer({
        fromAccount: form.fromAccount, toAccount, amount: Number(form.amount), remarks: form.remarks,
      });
      setReceipt(r);
      setStep(2);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      onApi();
    }
  }

  function again() {
    setForm({ ...EMPTY, fromAccount: form.fromAccount, toOwn: form.toOwn });
    setPayee(null);
    setReceipt(null);
    setStep(0);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Fund Transfer</h2>
          <div className="muted">Instant transfer between Horizon Bank accounts · available 24×7</div>
        </div>
      </div>

      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <span className="num">{i < step ? '✓' : i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {error && <div className="alert error">{error}</div>}

      {step === 0 && (
        <form className="xfer-form" onSubmit={review}>
          <label>Transfer from
            <select value={form.fromAccount} onChange={set('fromAccount')}>
              {accounts.map((a) => (
                <option key={a.accountNo} value={a.accountNo}>
                  {typeLabel[a.accountType]} · {mask(a.accountNo)} · {inr(a.balance)}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field-label">Transfer to</span>
            <div className="radio-row">
              <label className="radio"><input type="radio" name="mode" value="own" checked={form.mode === 'own'} onChange={set('mode')} /> My own account</label>
              <label className="radio"><input type="radio" name="mode" value="other" checked={form.mode === 'other'} onChange={set('mode')} /> Other Horizon Bank account</label>
            </div>
          </div>

          {form.mode === 'own' ? (
            <label>Credit account
              <select value={form.toOwn} onChange={set('toOwn')}>
                <option value="">Select account</option>
                {accounts.filter((a) => a.accountNo !== form.fromAccount).map((a) => (
                  <option key={a.accountNo} value={a.accountNo}>{typeLabel[a.accountType]} · {mask(a.accountNo)}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>Beneficiary account number
              <div className="inline">
                <input value={form.toOther} onChange={set('toOther')} placeholder="e.g. 602501000201" maxLength={14} inputMode="numeric" />
                <button type="button" className="btn-ghost" onClick={verifyPayee} disabled={busy || form.toOther.trim().length < 12}>Verify</button>
              </div>
              {payee && <span className="payee-ok">✓ {payee.holderName} · {payee.branch}</span>}
              <span className="hint">Try 602501000201 (Priya S.), 602501000301 (Rahul V.) or 602501000501 (Vikram R.)</span>
            </label>
          )}

          <label>Amount (₹)
            <input value={form.amount} onChange={set('amount')} placeholder="0.00" inputMode="decimal" />
            {from && <span className="hint">Available balance: {inr(from.balance)}</span>}
          </label>

          <label>Remarks (optional)
            <input value={form.remarks} onChange={set('remarks')} maxLength={40} placeholder="e.g. Rent for October" />
          </label>

          <div className="actions">
            <button type="submit" className="btn-primary">Continue</button>
          </div>
        </form>
      )}

      {step === 1 && (
        <div className="review">
          <dl>
            <dt>From</dt><dd>{from && `${typeLabel[from.accountType]} · ${mask(from.accountNo)}`}</dd>
            <dt>To</dt><dd>{toLabel}</dd>
            <dt>Amount</dt><dd className="big">{inr(Number(form.amount))}</dd>
            <dt>Remarks</dt><dd>{form.remarks || '—'}</dd>
            <dt>Mode</dt><dd>Internal transfer (instant)</dd>
          </dl>
          <div className="actions">
            <button type="button" className="btn-ghost" onClick={() => setStep(0)} disabled={busy}>Back</button>
            <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>
              {busy ? 'Processing…' : 'Confirm & Transfer'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && receipt && (
        <div className="receipt">
          <div className="tick">✓</div>
          <h3>Transfer successful</h3>
          <div className="big">{inr(receipt.amount)}</div>
          <dl>
            <dt>Reference no.</dt><dd className="mono">{receipt.reference}</dd>
            <dt>From</dt><dd>{mask(receipt.fromAccount)}</dd>
            <dt>To</dt><dd>{mask(receipt.toAccount)}</dd>
            <dt>Balance after</dt><dd>{inr(receipt.fromBalance)}</dd>
            <dt>Date &amp; time</dt><dd>{new Date(receipt.createdAt).toLocaleString('en-IN')}</dd>
          </dl>
          <div className="cache-updates">
            <div className="cu-title">Redis cache updated after COMMIT</div>
            {receipt.cacheUpdates.length === 0 && <div className="muted small">Cache disabled or Redis down — nothing to update.</div>}
            {receipt.cacheUpdates.map((u) => (
              <div key={u.key} className="cu-row">
                <code>{u.key}</code>
                <span>{u.action}{u.ttl ? ` · TTL ${u.ttl}s` : ''}</span>
              </div>
            ))}
          </div>
          <div className="actions">
            <button type="button" className="btn-ghost" onClick={again}>New transfer</button>
            <button type="button" className="btn-primary" onClick={() => onViewStatement(receipt.fromAccount)}>View statement</button>
          </div>
        </div>
      )}
    </section>
  );
}
