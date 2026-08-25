import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { AttachmentStorageService } from './attachment-storage.service';
import type { EnvironmentVariables } from '../config/env.validation';

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolvePromise(Buffer.concat(chunks)));
    stream.on('error', rejectPromise);
  });
}

describe('AttachmentStorageService', () => {
  let baseDir: string;
  let service: AttachmentStorageService;

  beforeAll(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'crm-attach-'));

    const configService = {
      get: () => baseDir,
    } as unknown as ConfigService<EnvironmentVariables, true>;

    service = new AttachmentStorageService(configService);
  });

  afterAll(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('writes a file and returns a storageKey matching customers/<uuid>/<uuid>.pdf', async () => {
    const customerId = randomUUID();
    const buffer = Buffer.from('%PDF-1.4 test content');

    const result = await service.save(customerId, buffer, 'application/pdf');

    expect(result.storageKey).toMatch(new RegExp(`^customers/${customerId}/[0-9a-f-]{36}\\.pdf$`));
  });

  it('returns a checksumSha256 equal to an independently computed SHA-256', async () => {
    const buffer = Buffer.from('checksum me');

    const result = await service.save(randomUUID(), buffer, 'application/pdf');

    const expected = createHash('sha256').update(buffer).digest('hex');
    expect(result.checksumSha256).toBe(expected);
  });

  it('throws for a mime type absent from the whitelist', async () => {
    await expect(service.save(randomUUID(), Buffer.from('x'), 'image/svg+xml')).rejects.toThrow();
  });

  it('creates the nested directory when it does not exist', async () => {
    const customerId = randomUUID();
    const result = await service.save(customerId, Buffer.from('nested'), 'text/plain');

    const bytes = await readFile(join(baseDir, result.storageKey));
    expect(bytes.toString()).toBe('nested');
  });

  it('remove deletes the file, and calling it twice does not throw', async () => {
    const customerId = randomUUID();
    const result = await service.save(customerId, Buffer.from('to be removed'), 'text/plain');

    await expect(service.remove(result.storageKey)).resolves.toBeUndefined();
    await expect(service.remove(result.storageKey)).resolves.toBeUndefined();
  });

  it('createStream on a saved key yields the original bytes', async () => {
    const buffer = Buffer.from('stream me back');
    const result = await service.save(randomUUID(), buffer, 'text/plain');

    const stream = service.createStream(result.storageKey);
    const read = await streamToBuffer(stream);

    expect(read.equals(buffer)).toBe(true);
  });

  describe('path traversal', () => {
    it('createStream on a traversal key throws and touches nothing outside baseDir', () => {
      expect(() => service.createStream('../../../etc/passwd')).toThrow();
    });

    it('remove on a traversal key throws and touches nothing outside baseDir', async () => {
      await expect(service.remove('..\\..\\secrets')).rejects.toThrow();
    });
  });
});
