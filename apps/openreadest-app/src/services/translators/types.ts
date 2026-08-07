import { TranslatorName } from './providers';

export interface TranslationProvider {
  name: string;
  label: string;
  authRequired?: boolean;
  quotaExceeded?: boolean;
  /**
   * Optional cache namespace for this provider.
   * When present, it is used as the provider dimension of cache keys instead of
   * `name`, so providers whose behavior depends on extra identity (e.g. AI model
   * / base URL) can isolate cached translations per identity.
   */
  getCacheNamespace?: () => string;
  translate: (
    texts: string[],
    sourceLang: string,
    targetLang: string,
    token?: string | null,
    useCache?: boolean,
  ) => Promise<string[]>;
}

export interface TranslationCache {
  [key: string]: string;
}

export interface UseTranslatorOptions {
  provider?: TranslatorName;
  sourceLang?: string;
  targetLang?: string;
  enablePolishing?: boolean;
  enablePreprocessing?: boolean;
}

export const ErrorCodes = {
  UNAUTHORIZED: 'Unauthorized',
  DAILY_QUOTA_EXCEEDED: 'Daily Quota Exceeded',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
};
