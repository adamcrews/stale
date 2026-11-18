import {IStateStorage} from '../../interfaces/state/state-storage.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as core from '@actions/core';
import {context, getOctokit} from '@actions/github';
import {retry as octokitRetry} from '@octokit/plugin-retry';
import * as cache from '@actions/cache';
import {parseRepository} from '../../functions/parse-repository.js';

const CACHE_KEY = '_state';
const STATE_FILE = 'state.txt';
const STALE_DIR = '56acbeaa-1fef-4c79-8f84-7565e560fb03';

// Keep the historical key for the workflow's own repository; otherwise scope
// it to the target so runs against different repositories don't overwrite each other.
export const getCacheKey = (
  repository: string,
  current: {owner: string; repo: string} = context.repo
): string => {
  const {owner, repo} = parseRepository(repository);
  if (
    owner.toLowerCase() === current.owner.toLowerCase() &&
    repo.toLowerCase() === current.repo.toLowerCase()
  ) {
    return CACHE_KEY;
  }
  return `${CACHE_KEY}_${owner}_${repo}`.toLowerCase();
};

const mkTempDir = (): string => {
  const tmpDir = path.join(os.tmpdir(), STALE_DIR);
  fs.mkdirSync(tmpDir, {recursive: true});
  return tmpDir;
};

const unlinkSafely = (filePath: string) => {
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
};

const getOctokitClient = () => {
  const token = core.getInput('repo-token');
  return getOctokit(token, undefined, octokitRetry);
};

const checkIfCacheExists = async (cacheKey: string): Promise<boolean> => {
  const client = getOctokitClient();
  try {
    const cachesResult = await client.rest.actions.getActionsCacheList({
      owner: context.repo.owner,
      repo: context.repo.repo,
      key: cacheKey // prefix matching
    });
    const caches: Array<{key?: string}> =
      cachesResult.data['actions_caches'] || [];
    return caches.some(cache => cache['key'] === cacheKey);
  } catch (error) {
    core.debug(`Error checking if cache exist: ${error.message}`);
  }
  return false;
};
const resetCacheWithOctokit = async (cacheKey: string): Promise<void> => {
  const client = getOctokitClient();
  core.debug(`remove cache "${cacheKey}"`);
  try {
    await client.rest.actions.deleteActionsCacheByKey({
      owner: context.repo.owner,
      repo: context.repo.repo,
      key: cacheKey
    });
  } catch (error) {
    if (error.status) {
      core.warning(
        `Error delete ${cacheKey}: [${error.status}] ${
          error.message || 'Unknown reason'
        }`
      );
    } else {
      throw error;
    }
  }
};
export class StateCacheStorage implements IStateStorage {
  private readonly cacheKey: string;

  constructor(repository?: string) {
    this.cacheKey = repository ? getCacheKey(repository) : CACHE_KEY;
  }

  async save(serializedState: string): Promise<void> {
    const tmpDir = mkTempDir();
    const filePath = path.join(tmpDir, STATE_FILE);
    fs.writeFileSync(filePath, serializedState);

    try {
      const cacheExists = await checkIfCacheExists(this.cacheKey);
      if (cacheExists) {
        await resetCacheWithOctokit(this.cacheKey);
      }
      const fileSize = fs.statSync(filePath).size;

      if (fileSize === 0) {
        core.info(`the state will be removed`);
        return;
      }

      await cache.saveCache([path.dirname(filePath)], this.cacheKey);
    } catch (error) {
      core.warning(
        `Saving the state was not successful due to "${
          error.message || 'unknown reason'
        }"`
      );
    } finally {
      unlinkSafely(filePath);
    }
  }

  async restore(): Promise<string> {
    const tmpDir = mkTempDir();
    const filePath = path.join(tmpDir, STATE_FILE);
    unlinkSafely(filePath);
    try {
      const cacheExists = await checkIfCacheExists(this.cacheKey);
      if (!cacheExists) {
        core.info(
          'The saved state was not found, the process starts from the first issue.'
        );
        return '';
      }

      await cache.restoreCache([path.dirname(filePath)], this.cacheKey);

      if (!fs.existsSync(filePath)) {
        core.warning(
          'Unknown error when unpacking the cache, the process starts from the first issue.'
        );
        return '';
      }
      return fs.readFileSync(path.join(tmpDir, STATE_FILE), {
        encoding: 'utf8'
      });
    } catch (error) {
      core.warning(
        `Restoring the state was not successful due to "${
          error.message || 'unknown reason'
        }"`
      );
      return '';
    }
  }
}
