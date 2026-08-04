import { CloudProfile } from '../models';
import { RemoteObjectStore } from './types';
import { WebDavObjectStore } from './WebDavObjectStore';

export const createRemoteObjectStore = async (
  profile: CloudProfile,
): Promise<RemoteObjectStore> => {
  if (profile.provider === 'webdav') return new WebDavObjectStore(profile.config);
  const { S3ObjectStore } = await import('./S3ObjectStore');
  return new S3ObjectStore(profile.config);
};

