export interface IRepository {
  owner: string;
  repo: string;
}

const REPOSITORY_PATTERN = /^([^/\s]+)\/([^/\s]+)$/;

export function parseRepository(repository: string): IRepository {
  const match = REPOSITORY_PATTERN.exec(repository);
  if (!match || match[2] === '.' || match[2] === '..') {
    throw new Error(
      `Invalid repository "${repository}": expected the "owner/repo" format`
    );
  }
  return {owner: match[1], repo: match[2]};
}
