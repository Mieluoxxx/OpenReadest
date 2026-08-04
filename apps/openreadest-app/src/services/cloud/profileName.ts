import { CloudProvider } from './models';

export const CLOUD_PROFILE_NAME_PATTERN = /^[\u4e00-\u9fffA-Za-z0-9_]{1,32}$/;

export const normalizeCloudProfileName = (name: string) => name.trim();

export const isValidCloudProfileName = (name: string) => {
  return CLOUD_PROFILE_NAME_PATTERN.test(normalizeCloudProfileName(name));
};

export const validateCloudProfileName = (
  name: string,
  usedNames: string[],
  selfId: string | null,
  idToName: Record<string, string>,
) => {
  const normalized = normalizeCloudProfileName(name);
  if (!normalized) return { ok: false as const, name: normalized, error: '备注名不能为空' };
  if (normalized.length > 32) {
    return {
      ok: false as const,
      name: normalized,
      error: '备注名长度不能超过 32 个字符',
    };
  }
  if (!CLOUD_PROFILE_NAME_PATTERN.test(normalized)) {
    return {
      ok: false as const,
      name: normalized,
      error: '备注名仅支持中文、英文、数字及下划线',
    };
  }
  const selfName = selfId ? idToName[selfId] : undefined;
  if (usedNames.includes(normalized) && normalized !== selfName) {
    return { ok: false as const, name: normalized, error: '备注名已存在' };
  }
  return { ok: true as const, name: normalized };
};

export const getUniqueCloudProfileName = (
  provider: CloudProvider,
  existingNames: string[],
) => {
  const base = provider === 's3' ? 'S3' : 'WebDAV';
  const used = new Set(existingNames);
  if (!used.has(base)) return base;
  for (let index = 1; index < 10000; index += 1) {
    const candidate = `${base}_${index}`;
    if (candidate.length <= 32 && !used.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`.slice(0, 32);
};

