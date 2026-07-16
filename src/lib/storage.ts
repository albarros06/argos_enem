import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, fakeVendorsEnabled } from "@/lib/config";
import { logger } from "@/lib/logger";

export interface StorageAdapter {
  presignUpload(key: string, contentType: string): Promise<string>;
  presignDownload(key: string): Promise<string>;
  putObject(key: string, bytes: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}

class R2Storage implements StorageAdapter {
  private client = new S3Client({
    region: "auto",
    endpoint: env().R2_ENDPOINT,
    credentials: {
      accessKeyId: env().R2_ACCESS_KEY_ID,
      secretAccessKey: env().R2_SECRET_ACCESS_KEY,
    },
  });

  presignUpload(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: env().R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: 600 });
  }

  presignDownload(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: env().R2_BUCKET, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  async putObject(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await logger.vendorCall("r2", "putObject", () =>
      this.client.send(
        new PutObjectCommand({
          Bucket: env().R2_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      ),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await logger.vendorCall("r2", "getObject", () =>
      this.client.send(new GetObjectCommand({ Bucket: env().R2_BUCKET, Key: key })),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Objeto vazio no storage: ${key}`);
    }
    return Buffer.from(bytes);
  }

  async deleteObject(key: string): Promise<void> {
    await logger.vendorCall("r2", "deleteObject", () =>
      this.client.send(new DeleteObjectCommand({ Bucket: env().R2_BUCKET, Key: key })),
    );
  }
}

// In-memory storage used when FAKE_VENDORS=1; uploads go through /api/fake-upload.
const globalForStorage = globalThis as unknown as { fakeObjects?: Map<string, Buffer> };

class FakeStorage implements StorageAdapter {
  private get objects(): Map<string, Buffer> {
    globalForStorage.fakeObjects ??= new Map();
    return globalForStorage.fakeObjects;
  }

  async presignUpload(key: string): Promise<string> {
    return `${env().APP_URL}/api/fake-upload/${encodeURIComponent(key)}`;
  }

  async presignDownload(key: string): Promise<string> {
    return `${env().APP_URL}/api/fake-upload/${encodeURIComponent(key)}`;
  }

  async putObject(key: string, bytes: Buffer): Promise<void> {
    this.objects.set(key, bytes);
  }

  async getObject(key: string): Promise<Buffer> {
    const bytes = this.objects.get(key);
    if (!bytes) {
      throw new Error(`Objeto não encontrado no storage fake: ${key}`);
    }
    return bytes;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  has(key: string): boolean {
    return this.objects.has(key);
  }
}

let cached: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (!cached) {
    cached = fakeVendorsEnabled() ? new FakeStorage() : new R2Storage();
  }
  return cached;
}

export function fakeStorageHas(key: string): boolean {
  const adapter = storage();
  return adapter instanceof FakeStorage && adapter.has(key);
}
