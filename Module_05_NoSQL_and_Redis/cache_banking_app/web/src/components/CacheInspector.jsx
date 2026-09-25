import { useEffect, useState } from 'react';
import { api } from '../api.js';

// A developer strip under the dashboard: what is in Redis right now.
export default function CacheInspector({ tick, onCleared }) {
  const [open, setOpen] = useState(true);
  const [stats, setStats] = useState(null);
  const [keys, setKeys] = useState([]);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.cacheStats(), api.cacheKeys()])
      .then(([s, k]) => { setStats(s); setKeys(k); })
      .catch(() => setStats({ redis: 'down' }));
  }, [tick, open]);

  async function clear() {
    await api.clearCache();
    onCleared();
  }

  return (
    <section className="inspector">
      <button type="button" className="insp-head" onClick={() => setOpen((o) => !o)}>
        <span>⚡ Cache Inspector <span className="muted">(training view — not part of a real bank UI)</span></span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && stats && (
        <div className="insp-body">
          <div className="insp-stats">
            <Stat label="Redis" value={stats.redis === 'up' ? 'UP' : 'DOWN'} tone={stats.redis === 'up' ? 'ok' : 'bad'} />
            <Stat label="Hits" value={stats.hits ?? 0} />
            <Stat label="Misses" value={stats.misses ?? 0} />
            <Stat label="Hit rate" value={`${stats.hitRate ?? 0}%`} />
            <Stat label="Memory" value={`${stats.usedMemory ?? '-'} / ${stats.maxMemory ?? '-'}`} />
            <Stat label="Eviction" value={stats.policy ?? '-'} />
            <Stat label="On write" value={stats.onWrite ?? '-'} />
          </div>
          <table className="insp-keys">
            <thead><tr><th>Key</th><th className="num">TTL (s)</th><th className="num">Bytes</th></tr></thead>
            <tbody>
              {keys.length === 0 && <tr><td colSpan="3" className="empty">No bank:* keys in Redis — the next enquiry will be a MISS.</td></tr>}
              {keys.map((k) => (
                <tr key={k.key}><td className="mono">{k.key}</td><td className="num">{k.ttl}</td><td className="num">{k.bytes}</td></tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn-danger" onClick={clear}>Clear cache</button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
