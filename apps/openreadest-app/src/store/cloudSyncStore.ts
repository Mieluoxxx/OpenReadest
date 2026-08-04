import { create } from 'zustand';
import {
  CloudProfile,
  CloudProvider,
  CloudSyncLogItem,
  CloudSyncProgress,
} from '@/services/cloud/models';
import {
  getUniqueCloudProfileName,
  isValidCloudProfileName,
  normalizeCloudProfileName,
} from '@/services/cloud/profileName';

export type CloudSyncTab = 'upload' | 'download' | 'logs' | 'profiles';

interface StoredCloudSyncState {
  profiles: CloudProfile[];
  activeProfileId: string | null;
  logs: CloudSyncLogItem[];
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
}

interface CloudSyncState extends StoredCloudSyncState {
  isCloudSyncCenterOpen: boolean;
  centerProvider: CloudProvider;
  activeTab: CloudSyncTab;
  isSyncing: boolean;
  isPaused: boolean;
  progress: CloudSyncProgress | null;
  lastSuccessAt: number | null;

  setCloudSyncCenterOpen: (open: boolean, provider?: CloudProvider) => void;
  setCenterProvider: (provider: CloudProvider) => void;
  setActiveTab: (tab: CloudSyncTab) => void;
  setProfiles: (profiles: CloudProfile[]) => void;
  upsertProfile: (profile: CloudProfile) => void;
  deleteProfile: (id: string) => void;
  setActiveProfileId: (id: string | null) => void;
  setSyncing: (syncing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setProgress: (progress: CloudSyncProgress | null) => void;
  setLastSuccessAt: (timestamp: number | null) => void;
  addLog: (log: CloudSyncLogItem) => void;
  clearLogs: () => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  setAutoSyncIntervalMinutes: (minutes: number) => void;
  restore: (data?: Partial<StoredCloudSyncState>) => void;
}

export const CLOUD_SYNC_STORAGE_KEY = 'openreadest_cloud_sync_v1';

const emptyStoredState = (): StoredCloudSyncState => ({
  profiles: [],
  activeProfileId: null,
  logs: [],
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 15,
});

const sanitizeProfiles = (profiles: CloudProfile[]): CloudProfile[] => {
  const names: string[] = [];
  const sanitized: CloudProfile[] = [];
  for (const profile of profiles) {
    if (profile.provider !== 'webdav' && profile.provider !== 's3') continue;
    const normalized = normalizeCloudProfileName(profile.name || '');
    const name =
      normalized && isValidCloudProfileName(normalized) && !names.includes(normalized)
        ? normalized
        : getUniqueCloudProfileName(profile.provider, names);
    names.push(name);
    if (profile.provider === 'webdav') {
      sanitized.push({
        ...profile,
        name,
        conflictStrategy: profile.conflictStrategy || 'manual',
        config: {
          serverUrl: profile.config?.serverUrl ?? '',
          remotePath: profile.config?.remotePath ?? '',
          username: profile.config?.username ?? '',
          password: profile.config?.password ?? '',
          allowInsecureHttp: !!profile.config?.allowInsecureHttp,
          allowInsecureTls: !!profile.config?.allowInsecureTls,
        },
      });
      continue;
    }
    sanitized.push({
      ...profile,
      name,
      conflictStrategy: profile.conflictStrategy || 'manual',
      config: {
        endpoint: profile.config?.endpoint ?? '',
        region: profile.config?.region ?? '',
        accessKeyId: profile.config?.accessKeyId ?? '',
        secretAccessKey: profile.config?.secretAccessKey ?? '',
        bucketName: profile.config?.bucketName ?? '',
        remotePrefix: profile.config?.remotePrefix ?? '',
        addressingStyle: profile.config?.addressingStyle,
      },
    });
  }
  return sanitized;
};

export const loadCloudSyncStoreFromStorage = (): StoredCloudSyncState => {
  if (typeof localStorage === 'undefined') return emptyStoredState();
  try {
    const parsed = JSON.parse(localStorage.getItem(CLOUD_SYNC_STORAGE_KEY) || '{}') as Partial<StoredCloudSyncState>;
    const profiles = sanitizeProfiles(parsed.profiles ?? []);
    const requestedActiveId = parsed.activeProfileId ?? null;
    return {
      profiles,
      activeProfileId: profiles.some((profile) => profile.id === requestedActiveId)
        ? requestedActiveId
        : (profiles[0]?.id ?? null),
      logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 500) : [],
      autoSyncEnabled: !!parsed.autoSyncEnabled,
      autoSyncIntervalMinutes: Math.max(
        5,
        Math.min(1440, Math.round(parsed.autoSyncIntervalMinutes ?? 15)),
      ),
    };
  } catch {
    return emptyStoredState();
  }
};

const persist = (state: StoredCloudSyncState) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(
    CLOUD_SYNC_STORAGE_KEY,
    JSON.stringify({
      profiles: state.profiles,
      activeProfileId: state.activeProfileId,
      logs: state.logs.slice(0, 500),
      autoSyncEnabled: state.autoSyncEnabled,
      autoSyncIntervalMinutes: state.autoSyncIntervalMinutes,
    } satisfies StoredCloudSyncState),
  );
};

export const useCloudSyncStore = create<CloudSyncState>((set, get) => ({
  ...emptyStoredState(),
  isCloudSyncCenterOpen: false,
  centerProvider: 'webdav',
  activeTab: 'upload',
  isSyncing: false,
  isPaused: false,
  progress: null,
  lastSuccessAt: null,

  setCloudSyncCenterOpen: (open, provider) =>
    set((state) => ({
      isCloudSyncCenterOpen: open,
      centerProvider: provider ?? state.centerProvider,
    })),
  setCenterProvider: (provider) => set({ centerProvider: provider }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setProfiles: (profiles) => {
    const nextProfiles = sanitizeProfiles(profiles);
    const current = get();
    const activeProfileId = nextProfiles.some((profile) => profile.id === current.activeProfileId)
      ? current.activeProfileId
      : (nextProfiles[0]?.id ?? null);
    set({ profiles: nextProfiles, activeProfileId });
    persist({ ...current, profiles: nextProfiles, activeProfileId });
  },
  upsertProfile: (profile) => {
    const current = get();
    const raw = current.profiles.some((item) => item.id === profile.id)
      ? current.profiles.map((item) => (item.id === profile.id ? profile : item))
      : [profile, ...current.profiles];
    const profiles = sanitizeProfiles(raw);
    set({ profiles, activeProfileId: profile.id, centerProvider: profile.provider });
    persist({ ...current, profiles, activeProfileId: profile.id });
  },
  deleteProfile: (id) => {
    const current = get();
    const profiles = current.profiles.filter((profile) => profile.id !== id);
    const activeProfileId =
      current.activeProfileId === id ? (profiles[0]?.id ?? null) : current.activeProfileId;
    set({ profiles, activeProfileId });
    persist({ ...current, profiles, activeProfileId });
  },
  setActiveProfileId: (activeProfileId) => {
    const current = get();
    set({ activeProfileId });
    persist({ ...current, activeProfileId });
  },
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPaused: (isPaused) => set({ isPaused }),
  setProgress: (progress) => set({ progress }),
  setLastSuccessAt: (lastSuccessAt) => set({ lastSuccessAt }),
  addLog: (log) => {
    const current = get();
    const logs = [log, ...current.logs].slice(0, 500);
    set({ logs });
    persist({ ...current, logs });
  },
  clearLogs: () => {
    const current = get();
    set({ logs: [] });
    persist({ ...current, logs: [] });
  },
  setAutoSyncEnabled: (autoSyncEnabled) => {
    const current = get();
    set({ autoSyncEnabled });
    persist({ ...current, autoSyncEnabled });
  },
  setAutoSyncIntervalMinutes: (minutes) => {
    const autoSyncIntervalMinutes = Math.max(5, Math.min(1440, Math.round(minutes)));
    const current = get();
    set({ autoSyncIntervalMinutes });
    persist({ ...current, autoSyncIntervalMinutes });
  },
  restore: (data) => {
    const loaded = { ...loadCloudSyncStoreFromStorage(), ...data };
    const profiles = sanitizeProfiles(loaded.profiles);
    const activeProfileId = profiles.some((profile) => profile.id === loaded.activeProfileId)
      ? loaded.activeProfileId
      : (profiles[0]?.id ?? null);
    set({ ...loaded, profiles, activeProfileId });
  },
}));
