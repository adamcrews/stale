import {expect, it, jest} from '@jest/globals';

const captured: {repository?: string} = {};

jest.unstable_mockModule('@actions/core', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn((name: string) =>
    ['days-before-stale', 'days-before-close', 'operations-per-run'].includes(
      name
    )
      ? '1'
      : ''
  )
}));
jest.unstable_mockModule('../src/services/state.service.js', () => ({
  getStateInstance: (options: {repository: string}) => {
    captured.repository = options.repository;
    throw new Error('stop after reading the options');
  }
}));

it('falls back to GITHUB_REPOSITORY when the repository input is empty', async () => {
  process.env.GITHUB_REPOSITORY = 'env-owner/env-repo';
  await import('../src/main.js');
  expect(captured.repository).toBe('env-owner/env-repo');
});
