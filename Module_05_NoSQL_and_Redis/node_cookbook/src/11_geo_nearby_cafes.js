/**
 * 11 - GEO - Find the nearest cafe
 *
 * Idea     : Store places with their longitude and latitude. Ask Redis
 *            "what is within 2 km of me?" and it does the maths.
 * Type     : Geospatial index (a Sorted Set underneath)
 * Commands : GEOADD, GEOSEARCH, GEODIST, GEOPOS
 * Run      : node src/11_geo_nearby_cafes.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Cafes in Pune ---');

await client.del('cafes');

// GEOADD needs longitude first, then latitude, then the name.
// (Longitude is the east-west number, latitude is north-south.)
await client.geoAdd('cafes', [
  { longitude: 73.8567, latitude: 18.5204, member: 'Cafe Central' },
  { longitude: 73.8600, latitude: 18.5250, member: 'Coffee Corner' },
  { longitude: 73.9100, latitude: 18.5600, member: 'Tea Stop' },
  { longitude: 73.7800, latitude: 18.4800, member: 'Bean House' },
]);

console.log('Saved 4 cafes.');

console.log('');
console.log('--- I am standing here ---');

const myLongitude = 73.8567;
const myLatitude = 18.5204;
console.log('My position:', myLongitude, myLatitude);

console.log('');
console.log('--- Which cafes are within 2 km? ---');

// GEOSEARCH finds every member inside a circle around a point.
const nearby = await client.geoSearch(
  'cafes',
  { longitude: myLongitude, latitude: myLatitude },
  { radius: 2, unit: 'km' },
);

console.log('Found:', nearby);
// [ 'Cafe Central', 'Coffee Corner' ]

console.log('');
console.log('--- Which cafes are within 10 km? ---');

const wider = await client.geoSearch(
  'cafes',
  { longitude: myLongitude, latitude: myLatitude },
  { radius: 10, unit: 'km' },
);

console.log('Found:', wider);

console.log('');
console.log('--- How far apart are two cafes? ---');

// GEODIST measures the distance between two saved places.
const distance = await client.geoDist('cafes', 'Cafe Central', 'Tea Stop', 'km');
console.log('Cafe Central to Tea Stop:', distance, 'km');

console.log('');
console.log('--- Where exactly is Bean House? ---');

const position = await client.geoPos('cafes', 'Bean House');
console.log(position);

console.log('');
console.log('This is the "find shops near me" feature in any delivery app.');
console.log('You store the places once, then every search is a single command.');

await client.quit();
