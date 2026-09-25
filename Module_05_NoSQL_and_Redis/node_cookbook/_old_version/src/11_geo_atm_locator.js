/**
 * 11 · GEOSPATIAL · Nearest ATM / branch locator
 * ---------------------------------------------------------------------
 * Use case    "Show me ICICI ATMs within 3 km of where I am standing,
 *             nearest first" - the map screen in the mobile app.
 * Structure   Geospatial index, which is a Sorted Set whose score is a
 *             52-bit geohash of the coordinates. Everything you know about
 *             Sorted Sets still applies.
 * Commands    GEOADD · GEOSEARCH · GEODIST · GEOPOS · ZSCORE · ZCARD
 * Why Redis   A radius query over 20,000 ATMs answered in microseconds,
 *             without PostGIS and without pulling the whole table into Node
 *             to compute haversine distances.
 * Run         node src/11_geo_atm_locator.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const ATMS = 'icici:geo:atm:mumbai';

async function recipe(client) {
  banner('11', 'Geospatial', 'Nearest ATM locator');
  await reset(client, 'icici:geo:*');

  step('Load the Mumbai ATM estate');
  await client.geoAdd(ATMS, [
    { longitude: 72.8347, latitude: 18.9220, member: 'ATM-COLABA-01' },
    { longitude: 72.8296, latitude: 18.9432, member: 'ATM-CHURCHGATE-04' },
    { longitude: 72.8258, latitude: 18.9750, member: 'ATM-MAHALAXMI-02' },
    { longitude: 72.8478, latitude: 19.0176, member: 'ATM-DADAR-11' },
    { longitude: 72.8697, latitude: 19.1136, member: 'ATM-ANDHERI-07' },
    { longitude: 72.8410, latitude: 19.0760, member: 'ATM-BANDRA-03' },
  ]);
  cmd(`GEOADD ${ATMS} 72.8347 18.9220 ATM-COLABA-01 ...`, await client.zCard(ATMS));
  say('Longitude first, then latitude - the opposite of how most people say it,');
  say('and the most common bug in geo code.');

  step('The customer is at Nariman Point. ATMs within 5 km, nearest first');
  const near = await client.geoSearchWith(
    ATMS,
    { longitude: 72.8258, latitude: 18.9260 },
    { radius: 5, unit: 'km' },
    ['WITHDIST', 'WITHCOORD'],
    { SORT: 'ASC' },
  );
  cmd(`GEOSEARCH ${ATMS} FROMLONLAT 72.8258 18.9260 BYRADIUS 5 km ASC WITHDIST`, '');
  near.forEach((hit, i) => {
    say(`  ${i + 1}. ${hit.member.padEnd(20)} ${Number(hit.distance).toFixed(2)} km`);
  });
  say('Sorted by real distance, computed on the server. Nothing else was read.');

  step('Widen to 20 km and cap the result at three');
  const wider = await client.geoSearchWith(
    ATMS,
    { longitude: 72.8258, latitude: 18.9260 },
    { radius: 20, unit: 'km' },
    ['WITHDIST'],
    { SORT: 'ASC', COUNT: 3 },
  );
  wider.forEach((hit) => say(`  ${hit.member.padEnd(20)} ${Number(hit.distance).toFixed(2)} km`));
  say('COUNT stops the search early - important when the radius is generous.');

  step('Search a rectangle instead of a circle (a map viewport)');
  const box = await client.geoSearch(
    ATMS,
    { longitude: 72.8400, latitude: 19.0400 },
    { width: 12, height: 12, unit: 'km' },
  );
  cmd(`GEOSEARCH ${ATMS} FROMLONLAT 72.84 19.04 BYBOX 12 12 km`, box);
  say('BYBOX is the right shape for "what is on screen right now".');

  step('Distance between two branches, and where one of them is');
  const d = await client.geoDist(ATMS, 'ATM-COLABA-01', 'ATM-ANDHERI-07', 'km');
  cmd(`GEODIST ${ATMS} ATM-COLABA-01 ATM-ANDHERI-07 km`, `${Number(d).toFixed(2)} km`);
  const pos = await client.geoPos(ATMS, 'ATM-DADAR-11');
  cmd(`GEOPOS ${ATMS} ATM-DADAR-11`, JSON.stringify(pos[0]));
  say('The coordinates come back slightly changed - the geohash is 52 bits, so');
  say('positions are accurate to well under a metre, but not bit-for-bit.');

  step('It really is a Sorted Set underneath');
  cmd(`ZSCORE ${ATMS} ATM-DADAR-11`, await client.zScore(ATMS, 'ATM-DADAR-11'));
  cmd(`OBJECT ENCODING ${ATMS}`, await client.objectEncoding(ATMS));
  say('That score is the geohash. ZREM removes an ATM, ZCARD counts them -');
  say('there is no separate "geo type" to learn.');

  takeaway(
    'GEOADD once, GEOSEARCH per request. Longitude before latitude, and '
    + 'remember it is a Sorted Set, so every ZSET command still works on it.',
  );
}

main(recipe);
