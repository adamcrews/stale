export interface IRepository {
  owner: string;
  repo: string;
}

// owner: alphanumerics and hyphens; repo: alphanumerics, hyphens, underscores, and dots
const REPOSITORY_PATTERN = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/;

export function parseRepository(repository: string): IRepository {
  const match = REPOSITORY_PATTERN.exec(repository);
  if (!match || match[2] === '.' || match[2] === '..') {
    throw new Error(
      `Invalid repository "${repository}": expected the "owner/repo" format`
    );
  }
  return {owner: match[1], repo: match[2]};
}
