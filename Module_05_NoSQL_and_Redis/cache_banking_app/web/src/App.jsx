import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import AccountCards from './components/AccountCards.jsx';
import TransactionsView from './components/TransactionsView.jsx';
import TransferView from './components/TransferView.jsx';
import CacheInspector from './components/CacheInspector.jsx';

// The dashboard is always "logged in" as customer 1 (Arjun Mehta) - there is no auth in this demo.
const CUSTOMER_ID = 1;

export default function App() {
  // ?view=transfer opens the transfer screen directly (handy for screenshots and demos)
  const [view, setView] = useState(
    new URLSearchParams(window.location.search).get('view') === 'transfer' ? 'transfer' : 'transactions',
  );
  const [customer, setCustomer] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountsMeta, setAccountsMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  // bumped after every API call so the cache inspector re-reads Redis
  const [cacheTick, setCacheTick] = useState(0);
  const touchCache = useCallback(() => setCacheTick((t) => t + 1), []);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.accounts(CUSTOMER_ID);
      setAccounts(res.data);
      setAccountsMeta(res);
      setSelected((cur) => cur ?? res.data[0]?.accountNo);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      touchCache();
    }
  }, [touchCache]);

  useEffect(() => {
    api.customer(CUSTOMER_ID).then(setCustomer).catch((e) => setError(e.message));
    loadAccounts();
  }, [loadAccounts]);

  const openStatement = (accountNo) => {
    setSelected(accountNo);
    setView('transactions');
  };

  return (
    <div className="shell">
      <Header customer={customer} />
      <div className="body">
        <Sidebar view={view} onChange={setView} />
        <main className="main">
          <div className="crumbs">
            Home <span>›</span> {view === 'transactions' ? 'Accounts › Account Statement' : 'Payments › Fund Transfer'}
          </div>
          {error && <div className="alert error">{error}</div>}

          <AccountCards
            accounts={accounts}
            meta={accountsMeta}
            selected={selected}
            onSelect={openStatement}
            onRefresh={loadAccounts}
          />

          {view === 'transactions' && selected && (
            <TransactionsView
              accountNo={selected}
              account={accounts.find((a) => a.accountNo === selected)}
              onLoaded={touchCache}
            />
          )}
          {view === 'transfer' && (
            <TransferView
              accounts={accounts}
              onDone={loadAccounts}
              onViewStatement={openStatement}
              onApi={touchCache}
            />
          )}

          <CacheInspector tick={cacheTick} onCleared={loadAccounts} />
        </main>
      </div>
    </div>
  );
}
