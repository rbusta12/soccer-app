const TtlCache = require('../services/ttlCache');

describe('TtlCache', () => {
  test('returns undefined for a missing key', () => {
    const cache = new TtlCache(1000);
    expect(cache.get('missing')).toBeUndefined();
  });

  test('stores and retrieves a value within the TTL window', () => {
    const cache = new TtlCache(1000);
    cache.set('epl', ['match1', 'match2']);
    expect(cache.get('epl')).toEqual(['match1', 'match2']);
  });

  test('expires a value after its TTL elapses', () => {
    jest.useFakeTimers();
    const cache = new TtlCache(1000);
    cache.set('epl', 'data');

    jest.advanceTimersByTime(1001);

    expect(cache.get('epl')).toBeUndefined();
    jest.useRealTimers();
  });

  test('size() reflects the number of stored entries', () => {
    const cache = new TtlCache(1000);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size()).toBe(2);
  });

  test('clear() removes all entries', () => {
    const cache = new TtlCache(1000);
    cache.set('a', 1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
