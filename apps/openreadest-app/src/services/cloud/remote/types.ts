import { CloudProvider } from '../models';

export interface RemoteObjectMetadata {
  key: string;
  etag?: string;
  lastModified?: string;
  size?: number;
}

export interface RemoteListEntry {
  key: string;
  kind: 'object' | 'prefix';
  metadata?: RemoteObjectMetadata;
}

export interface RemoteAccessResult {
  addressingStyle?: 'virtual' | 'path';
}

export interface RemoteObjectStore {
  readonly provider: CloudProvider;
  testAccess(): Promise<RemoteAccessResult>;
  listChildren(prefix: string): Promise<RemoteListEntry[]>;
  stat(key: string): Promise<RemoteObjectMetadata | null>;
  read(key: string): Promise<Uint8Array>;
  write(
    key: string,
    data: Uint8Array,
    options?: { contentType?: string },
  ): Promise<RemoteObjectMetadata>;
}

