import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const paginate = jest.fn(async (..._args: unknown[]) => [
  {key: '_state_other-org/other-repo'}
]);
const deleteActionsCacheByKey = jest.fn(async (..._args: unknown[]) => ({}));
const getActionsCacheList = jest.fn();

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
  restoreCache: jest.fn(async () => undefined)
}));

const {StateCacheStorage} =
  await import('../src/classes/state/state-cache-storage.js');

describe('StateCacheStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists and deletes caches in the running repo with the scoped key', async () => {
    const storage = new StateCacheStorage('other-org/other-repo');
    await storage.save('state');

    expect(paginate).toHaveBeenCalledWith(
      getActionsCacheList,
      expect.objectContaining({
        owner: 'run-owner',
        repo: 'run-repo',
        key: '_state_other-org/other-repo',
        per_page: 100
      })
    );
    expect(deleteActionsCacheByKey).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'run-owner',
        repo: 'run-repo',
        key: '_state_other-org/other-repo'
      })
    );
  });
});
