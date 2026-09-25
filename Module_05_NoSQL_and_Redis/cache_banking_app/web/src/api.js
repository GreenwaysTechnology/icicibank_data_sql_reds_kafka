// api.js - every call the UI makes. All paths are relative, so the same bundle
// works behind nginx (Docker) and behind the Vite dev proxy.

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export const api = {
  customer: (id) => request('GET', `/customers/${id}`),
  accounts: (id) => request('GET', `/customers/${id}/accounts`),
  transactions: (accountNo) => request('GET', `/accounts/${accountNo}/transactions`),
  lookup: (accountNo) => request('GET', `/accounts/${accountNo}/lookup`),
  transfer: (payload) => request('POST', '/transfers', payload),
  cacheStats: () => request('GET', '/cache/stats'),
  cacheKeys: () => request('GET', '/cache/keys'),
  clearCache: () => request('DELETE', '/cache'),
};

export const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })
    .format(n ?? 0);

export const mask = (accountNo) => `XXXX XXXX ${accountNo.slice(-4)}`;

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const typeLabel = { SAVINGS: 'Savings Account', SALARY: 'Salary Account', CURRENT: 'Current Account' };
