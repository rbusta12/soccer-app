const fetch = require('node-fetch');
const TtlCache = require('./ttlCache');

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Cache external responses for 30s. ESPN's scoreboard doesn't change
// faster than that in practice, and it keeps us polite to a public API
// we don't control.
const cache = new TtlCache(30 * 1000);

// A small, human-friendly allowlist of leagues we support, mapped to
// ESPN's internal league slugs. Extend this list to support more leagues.
const LEAGUES = {
  epl: 'eng.1',
  laliga: 'esp.1',
  seriea: 'ita.1',
  bundesliga: 'ger.1',
  ligue1: 'fra.1',
  mls: 'usa.1',
};

function isSupportedLeague(league) {
  return Object.prototype.hasOwnProperty.call(LEAGUES, league);
}

async function fetchFromEspn(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const err = new Error(`ESPN API responded with ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Get today's scoreboard for a given league, with simplified fields.
 * @param {string} league - one of the keys in LEAGUES (e.g. 'epl')
 */
async function getMatches(league) {
  const cacheKey = `matches:${league}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const slug = LEAGUES[league];
  const raw = await fetchFromEspn(`/${slug}/scoreboard`);

  const matches = (raw.events || []).map((event) => {
    const competition = event.competitions?.[0];
    const [home, away] = competition?.competitors || [];
    return {
      id: event.id,
      name: event.name,
      status: event.status?.type?.description,
      date: event.date,
      home: {
        team: home?.team?.displayName,
        score: home?.score,
      },
      away: {
        team: away?.team?.displayName,
        score: away?.score,
      },
    };
  });

  cache.set(cacheKey, matches);
  return matches;
}

/**
 * Get current standings for a given league.
 * @param {string} league - one of the keys in LEAGUES (e.g. 'epl')
 */
async function getStandings(league) {
  const cacheKey = `standings:${league}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const slug = LEAGUES[league];
  const raw = await fetchFromEspn(`/${slug}/standings`);

  const entries = raw.children?.[0]?.standings?.entries || [];
  const standings = entries.map((entry) => {
    const stats = Object.fromEntries(
      (entry.stats || []).map((s) => [s.name, s.value]),
    );
    return {
      team: entry.team?.displayName,
      rank: stats.rank,
      points: stats.points,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
    };
  });

  cache.set(cacheKey, standings);
  return standings;
}

module.exports = {
  LEAGUES,
  isSupportedLeague,
  getMatches,
  getStandings,
  // exported for tests that need to reset cache state between runs
  _cache: cache,
};
