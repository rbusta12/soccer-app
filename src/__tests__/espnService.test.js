jest.mock('node-fetch');
const fetch = require('node-fetch');
const espnService = require('../services/espnService');

const mockScoreboardResponse = {
  events: [
    {
      id: '12345',
      name: 'Arsenal vs Chelsea',
      date: '2026-08-06T19:00Z',
      status: { type: { description: 'Full Time' } },
      competitions: [
        {
          competitors: [
            { team: { displayName: 'Arsenal' }, score: '2' },
            { team: { displayName: 'Chelsea' }, score: '1' },
          ],
        },
      ],
    },
  ],
};

const mockStandingsResponse = {
  children: [
    {
      standings: {
        entries: [
          {
            team: { displayName: 'Arsenal' },
            stats: [
              { name: 'rank', value: 1 },
              { name: 'points', value: 70 },
              { name: 'wins', value: 22 },
              { name: 'losses', value: 3 },
              { name: 'ties', value: 4 },
            ],
          },
        ],
      },
    },
  ],
};

describe('espnService', () => {
  beforeEach(() => {
    espnService._cache.clear();
    fetch.mockReset();
  });

  test('isSupportedLeague recognizes known leagues', () => {
    expect(espnService.isSupportedLeague('epl')).toBe(true);
    expect(espnService.isSupportedLeague('not-a-league')).toBe(false);
  });

  test('getMatches maps ESPN response into simplified shape', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockScoreboardResponse,
    });

    const matches = await espnService.getMatches('epl');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(matches).toEqual([
      {
        id: '12345',
        name: 'Arsenal vs Chelsea',
        status: 'Full Time',
        date: '2026-08-06T19:00Z',
        home: { team: 'Arsenal', score: '2' },
        away: { team: 'Chelsea', score: '1' },
      },
    ]);
  });

  test('getMatches uses the cache on a second call within the TTL window', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockScoreboardResponse,
    });

    await espnService.getMatches('epl');
    await espnService.getMatches('epl');

    // Only one real network call should have happened - the second was served from cache.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('getMatches throws when ESPN responds with a non-OK status', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(espnService.getMatches('epl')).rejects.toThrow('503');
  });

  test('getStandings maps ESPN response into simplified shape', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStandingsResponse,
    });

    const standings = await espnService.getStandings('epl');

    expect(standings).toEqual([
      {
        team: 'Arsenal',
        rank: 1,
        points: 70,
        wins: 22,
        losses: 3,
        ties: 4,
      },
    ]);
  });
});
