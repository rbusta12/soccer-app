const request = require('supertest');

jest.mock('../services/espnService');
const espnService = require('../services/espnService');
const createApp = require('../app');

describe('routes', () => {
  const app = createApp();

  beforeEach(() => {
    jest.resetAllMocks();
    espnService.isSupportedLeague.mockImplementation((league) => league === 'epl');
    espnService.LEAGUES = { epl: 'eng.1' };
  });

  test('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET / returns service metadata', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('soccer-scores-api');
  });

  test('GET /api/matches/:league returns matches for a supported league', async () => {
    espnService.getMatches.mockResolvedValue([{ id: '1', name: 'Test Match' }]);

    const res = await request(app).get('/api/matches/epl');

    expect(res.status).toBe(200);
    expect(res.body.league).toBe('epl');
    expect(res.body.count).toBe(1);
    expect(res.body.matches).toHaveLength(1);
  });

  test('GET /api/matches/:league returns 404 for an unsupported league', async () => {
    const res = await request(app).get('/api/matches/not-a-real-league');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Unsupported league/);
  });

  test('GET /api/standings/:league returns standings for a supported league', async () => {
    espnService.getStandings.mockResolvedValue([{ team: 'Arsenal', rank: 1 }]);

    const res = await request(app).get('/api/standings/epl');

    expect(res.status).toBe(200);
    expect(res.body.standings).toHaveLength(1);
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/not-a-route');
    expect(res.status).toBe(404);
  });

  test('propagates a 502 when the service layer throws an unexpected error', async () => {
    espnService.getMatches.mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/api/matches/epl');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Upstream or internal error');
  });
});
