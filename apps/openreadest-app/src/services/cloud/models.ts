export type CloudProvider = 'webdav' | 's3';

export type CloudConflictResolutionStrategy = 'newest' | 'local' | 'remote' | 'manual';

interface CloudProfileBase {
  id: string;
  name: string;
  provider: CloudProvider;
  conflictStrategy: CloudConflictResolutionStrategy;
  lastSyncAt?: number;
}

export interface WebDavCloudProfile extends CloudProfileBase {
  provider: 'webdav';
  config: {
    serverUrl: string;
    remotePath: string;
    username: string;
    password: string;
    allowInsecureHttp?: boolean;
    allowInsecureTls?: boolean;
  };
}

export interface S3CloudProfile extends CloudProfileBase {
  provider: 's3';
  config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    remotePrefix: string;
    addressingStyle?: 'virtual' | 'path';
  };
}

export type CloudProfile = WebDavCloudProfile | S3CloudProfile;

export type CloudSyncDirection = 'upload' | 'download';

export type CloudSyncItemStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'conflict';

export interface CloudSyncLogItem {
  id: string;
  timestamp: number;
  direction: CloudSyncDirection;
  path: string;
  status: CloudSyncItemStatus;
  message?: string;
  provider?: CloudProvider;
  statusCode?: number;
  requestId?: string;
}

export interface CloudSyncProgress {
  totalItems: number;
  completedItems: number;
  currentPath?: string;
  currentDirection?: CloudSyncDirection;
}

export interface CloudConflictItem {
  path: string;
  local?: {
    size?: number;
    md5?: string;
    observedAt?: number;
  };
  remote?: {
    etag?: string;
    lastModified?: string;
    size?: number;
  };
}

export interface CloudSyncResult {
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  conflictCount: number;
  conflicts: CloudConflictItem[];
  stateWritten: boolean;
}

