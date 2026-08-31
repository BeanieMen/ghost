import * as fs from 'node:fs/promises';

export async function createDirectoryIfNotExists(
  dirPath: string,
): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function createFile(filePath: string, data = ''): Promise<void> {
  await fs.writeFile(filePath, data);
}
