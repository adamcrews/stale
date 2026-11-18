import {describe, expect, it, jest} from '@jest/globals';
import {parseRepository} from '../src/functions/parse-repository.js';
import {getCacheKey} from '../src/classes/state/state-cache-storage.js';
import {IssuesProcessor} from '../src/classes/issues-processor.js';
import {DefaultProcessorOptions} from './constants/default-processor-options.js';
import {generateIssue} from './functions/generate-issue.js';
import {alwaysFalseStateMock} from './classes/state-mock.js';

describe('parseRepository', () => {
  it('splits owner and repo', () => {
    expect(parseRepository('my-org/my.repo_1')).toStrictEqual({
      owner: 'my-org',
      repo: 'my.repo_1'
    });
  });

  it.each([
    '',
    'repo',
    'a/b/c',
    '/repo',
    'owner/',
    'ow ner/repo',
    'o/..',
    'o/.'
  ])('rejects "%s"', value => {
    expect(() => parseRepository(value)).toThrow('"owner/repo"');
  });
});

describe('getCacheKey', () => {
  const current = {owner: 'Acme', repo: 'Widgets'};

  it('keeps the legacy key for the workflow repository', () => {
    expect(getCacheKey('acme/widgets', current)).toBe('_state');
  });

  it('scopes the key to another repository', () => {
    expect(getCacheKey('acme/gadgets', current)).toBe('_state_acme/gadgets');
    expect(getCacheKey('other/widgets', current)).toBe('_state_other/widgets');
  });
});

describe('IssuesProcessor with a non-default repository', () => {
  it('uses the configured owner and repo for API calls', async () => {
    const listForRepo = jest.fn(async () => ({data: []}));
    const processor = new IssuesProcessor(
      {...DefaultProcessorOptions, repository: 'other-org/other-repo'},
      alwaysFalseStateMock
    );
    (processor as unknown as {client: unknown}).client = {
      rest: {issues: {listForRepo}}
    };

    await processor.getIssues(1);

    expect(listForRepo).toHaveBeenCalledWith(
      expect.objectContaining({owner: 'other-org', repo: 'other-repo'})
    );
  });

  it('rejects an invalid repository', () => {
    expect(
      () =>
        new IssuesProcessor(
          {...DefaultProcessorOptions, repository: 'nope'},
          alwaysFalseStateMock
        )
    ).toThrow('"owner/repo"');
  });
});

describe('getCacheKey with underscores and case', () => {
  it('cannot collide for owners and repos containing underscores', () => {
    const current = {owner: 'x', repo: 'y'};
    expect(getCacheKey('a_b/c', current)).not.toBe(
      getCacheKey('a/b_c', current)
    );
    expect(getCacheKey('A_B/C', current)).toBe('_state_a_b/c');
  });
});

describe('branch deletion with a non-default repository', () => {
  it('matches the head repo case-insensitively', async () => {
    const deleteRef = jest.fn(async () => ({}));
    const processor = new IssuesProcessor(
      {
        ...DefaultProcessorOptions,
        repository: 'Other-Org/Other-Repo',
        deleteBranch: true,
        debugOnly: false
      },
      alwaysFalseStateMock
    );
    const p = processor as unknown as Record<string, unknown>;
    p['client'] = {rest: {git: {deleteRef}}};
    p['getPullRequest'] = async () => ({
      head: {ref: 'feature', repo: {full_name: 'other-org/other-repo'}}
    });
    const issue = generateIssue(
      DefaultProcessorOptions,
      1,
      't',
      '2020-01-01T17:00:00Z',
      '2020-01-01T17:00:00Z',
      false,
      true
    );
    await (
      processor as unknown as {_deleteBranch(i: unknown): Promise<void>}
    )._deleteBranch(issue);
    expect(deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'Other-Org',
        repo: 'Other-Repo',
        ref: 'heads/feature'
      })
    );
  });
});
