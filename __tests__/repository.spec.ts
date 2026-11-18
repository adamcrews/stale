import {describe, expect, it, jest} from '@jest/globals';
import {parseRepository} from '../src/functions/parse-repository.js';
import {getCacheKey} from '../src/classes/state/state-cache-storage.js';
import {IssuesProcessor} from '../src/classes/issues-processor.js';
import {DefaultProcessorOptions} from './constants/default-processor-options.js';
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
    expect(getCacheKey('acme/gadgets', current)).toBe('_state_acme_gadgets');
    expect(getCacheKey('other/widgets', current)).toBe('_state_other_widgets');
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
