// Shows where a response came from - the whole point of the demo.
export default function CacheBadge({ meta }) {
  if (!meta) return null;
  const hit = meta.source === 'cache';
  return (
    <div className={`cache-badge ${hit ? 'hit' : 'miss'}`} title={meta.key}>
      <span className="dot" />
      {hit ? 'Redis cache HIT' : `Cache MISS · loaded from ${meta.source === 'database' ? 'PostgreSQL' : meta.source}`}
      <span className="sep">·</span>
      {meta.tookMs} ms
      {meta.ttl != null && (
        <>
          <span className="sep">·</span>
          TTL {meta.ttl}s
        </>
      )}
    </div>
  );
}
