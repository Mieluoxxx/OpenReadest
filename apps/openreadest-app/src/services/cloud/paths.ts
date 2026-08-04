import { Book } from '@/types/book';
import {
  getConfigFilename,
  getCoverFilename,
  getLibraryFilename,
  getLocalBookFilename,
} from '@/utils/book';

export const CLOUD_ROOT_DIRNAME = 'OpenReadest';
export const CLOUD_BOOKS_DIR = `${CLOUD_ROOT_DIRNAME}/Books`;
export const CLOUD_SYSTEM_DIR = `${CLOUD_ROOT_DIRNAME}/System`;

export const normalizeObjectKey = (value: string): string => {
  return value.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
};

export const joinObjectKeys = (...parts: string[]): string => {
  return parts.map(normalizeObjectKey).filter(Boolean).join('/');
};

export const getRemoteSyncStateKey = () => `${CLOUD_SYSTEM_DIR}/sync-state.json`;
export const getLocalSyncStatePath = (profileId: string) =>
  `cloud-sync/${encodeURIComponent(profileId)}/sync-state.json`;

export const getLocalLibraryPath = () => getLibraryFilename();
export const getRemoteLibraryKey = () => `${CLOUD_BOOKS_DIR}/library.json`;

export const getLocalBookPaths = (book: Book) => ({
  bookFile: getLocalBookFilename(book),
  coverFile: getCoverFilename(book),
  configFile: getConfigFilename(book),
});

export const getRemoteBookKeys = (book: Book) => {
  const local = getLocalBookPaths(book);
  return {
    bookFile: `${CLOUD_BOOKS_DIR}/${local.bookFile}`,
    coverFile: `${CLOUD_BOOKS_DIR}/${local.coverFile}`,
    configFile: `${CLOUD_BOOKS_DIR}/${local.configFile}`,
  };
};

