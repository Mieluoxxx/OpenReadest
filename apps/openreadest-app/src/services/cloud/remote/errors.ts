import { CloudProvider } from '../models';

export type RemoteStorageErrorCode =
  | 'invalid_config'
  | 'authentication_failed'
  | 'permission_denied'
  | 'not_found'
  | 'network_error'
  | 'timeout'
  | 'cors_error'
  | 'signature_error'
  | 'clock_skew'
  | 'server_error';

type RemoteStorageErrorOptions = {
  provider: CloudProvider;
  statusCode?: number;
  requestId?: string;
  key?: string;
  cause?: unknown;
};

export class RemoteStorageError extends Error {
  readonly code: RemoteStorageErrorCode;
  readonly provider: CloudProvider;
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly key?: string;

  constructor(code: RemoteStorageErrorCode, message: string, options: RemoteStorageErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'RemoteStorageError';
    this.code = code;
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
    this.key = options.key;
  }
}

export const getRemoteStorageErrorMessage = (error: unknown): string => {
  if (!(error instanceof RemoteStorageError)) return '远端请求失败';
  switch (error.code) {
    case 'invalid_config':
      return error.message || '云端配置无效';
    case 'authentication_failed':
      return '认证失败，请检查凭据';
    case 'permission_denied':
      return '权限不足，请检查 Bucket 和 Prefix 权限';
    case 'not_found':
      return '远端对象不存在';
    case 'timeout':
      return '连接超时';
    case 'cors_error':
      return '浏览器跨域请求被阻止，请配置 CORS';
    case 'signature_error':
      return '签名校验失败，请检查 Endpoint、Region 和凭据';
    case 'clock_skew':
      return '系统时间偏差导致签名失败';
    case 'server_error':
      return '远端服务暂时不可用';
    default:
      return '网络请求失败';
  }
};

