export interface IRepository {
  owner: string;
  repo: string;
}

const REPOSITORY_PATTERN = /^([\w.-]+)\/([\w.-]+)$/;

export function parseRepository(repository: string): IRepository {
  const match = REPOSITORY_PATTERN.exec(repository);
  if (
    !match ||
    [match[1], match[2]].some(part => part === '.' || part === '..')
  ) {
    throw new Error(
      `Invalid repository "${repository}": expected the "owner/repo" format`
    );
  }
  return {owner: match[1], repo: match[2]};
}
