import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const KEY = 'other-org/other-repo/_state';

const paginate = jest.fn(async (..._args: unknown[]): Promise<unknown[]> => [
  {key: KEY}
]);
const deleteActionsCacheByKey = jest.fn(async (..._args: unknown[]) => ({}));
const getActionsCacheList = jest.fn();
const restoreCache = jest.fn(
  async (..._args: unknown[]): Promise<string | undefined> => KEY
);

jest.unstable_mockModule('@actions/core', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  getInput: jest.fn(() => 'token')
}));
jest.unstable_mockModule('@actions/github', () => ({
  context: {repo: {owner: 'run-owner', repo: 'run-repo'}},
  getOctokit: jest.fn(() => ({
    paginate,
    rest: {actions: {getActionsCacheList, deleteActionsCacheByKey}}
  }))
}));
jest.unstable_mockModule('@actions/cache', () => ({
  saveCache: jest.fn(async () => 1),
  restoreCache
}));

const {StateCacheStorage} =
  await import('../src/classes/state/state-cache-storage.js');

describe('StateCacheStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    paginate.mockImplementation(async () => [{key: KEY}]);
    restoreCache.mockImplementation(async () => KEY);
  });

  it('lists and deletes caches in the running repo with the scoped key', async () => {
    await new StateCacheStorage('other-org/other-repo').save('state');

    expect(paginate).toHaveBeenCalledWith(
      getActionsCacheList,
      expect.objectContaining({
        owner: 'run-owner',
        repo: 'run-repo',
        key: KEY,
        per_page: 100
      })
    );
    expect(deleteActionsCacheByKey).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'run-owner',
        repo: 'run-repo',
        key: KEY
      })
    );
  });

  it('ignores prefix-only matches from the cache list', async () => {
    paginate.mockImplementation(async () => [{key: `${KEY}-2`}]);
    const storage = new StateCacheStorage('other-org/other-repo');

    await storage.save('state');
    expect(deleteActionsCacheByKey).not.toHaveBeenCalled();

    expect(await storage.restore()).toBe('');
    expect(restoreCache).not.toHaveBeenCalled();
  });

  it('restores with the scoped key', async () => {
    await new StateCacheStorage('other-org/other-repo').restore();
    expect(restoreCache).toHaveBeenCalledWith(expect.anything(), KEY);
  });

  it('treats a restore of a different key as a miss', async () => {
    restoreCache.mockImplementation(async () => `${KEY}-2`);
    expect(await new StateCacheStorage('other-org/other-repo').restore()).toBe(
      ''
    );
  });

  it('warns when restoreCache finds nothing', async () => {
    restoreCache.mockImplementation(async () => undefined);
    const core = await import('@actions/core');
    expect(await new StateCacheStorage('other-org/other-repo').restore()).toBe(
      ''
    );
    expect(core.warning).toHaveBeenCalled();
  });

  it('keeps the legacy key for the running repository', async () => {
    paginate.mockImplementation(async () => [{key: '_state'}]);
    await new StateCacheStorage('run-owner/run-repo').save('state');
    expect(deleteActionsCacheByKey).toHaveBeenCalledWith(
      expect.objectContaining({key: '_state'})
    );
  });
});
