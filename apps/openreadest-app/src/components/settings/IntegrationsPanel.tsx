import React, { useEffect, useState } from 'react';
import { MdChevronRight, MdCloud, MdStorage } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import {
  loadCloudSyncStoreFromStorage,
  useCloudSyncStore,
} from '@/store/cloudSyncStore';
import CloudSyncCenter from '@/app/library/components/CloudSyncCenter';
import { CloudProvider } from '@/services/cloud/models';

const IntegrationsPanel: React.FC = () => {
  const _ = useTranslation();
  const [selectedIntegration, setSelectedIntegration] = useState<CloudProvider | null>(null);
  const profiles = useCloudSyncStore((state) => state.profiles);
  const activeProfileId = useCloudSyncStore((state) => state.activeProfileId);
  const restore = useCloudSyncStore((state) => state.restore);

  useEffect(() => {
    restore(loadCloudSyncStoreFromStorage());
  }, [restore]);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const getStatus = (provider: CloudProvider) => {
    const providerProfiles = profiles.filter((profile) => profile.provider === provider);
    if (activeProfile?.provider === provider) return `${_('正在使用')} · ${activeProfile.name}`;
    if (providerProfiles.length > 0) {
      return _('已配置 {{count}} 个', { count: providerProfiles.length });
    }
    return _('Not configured');
  };

  if (selectedIntegration) {
    return (
      <div className='my-4 w-full space-y-6'>
        <div className='w-full'>
          <h2 className='mb-2 font-medium'>
            <button
              type='button'
              className='text-base-content/80 hover:text-base-content'
              onClick={() => setSelectedIntegration(null)}
            >
              {_('Integrations')}
            </button>
            <span className='text-base-content/50 px-2'>›</span>
            {selectedIntegration === 's3' ? 'S3' : _('WebDAV')}
          </h2>
          <CloudSyncCenter key={selectedIntegration} embedded provider={selectedIntegration} />
        </div>
      </div>
    );
  }

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>{_('Cloud Sync')}</h2>
        <div className='card border-base-200 bg-base-100 border shadow'>
          {(
            [
              { provider: 'webdav' as const, label: _('WebDAV'), icon: MdCloud },
              { provider: 's3' as const, label: 'S3', icon: MdStorage },
            ]
          ).map(({ provider, label, icon: Icon }, index) => (
            <button
              key={provider}
              type='button'
              className={`config-item w-full gap-3 text-left ${index > 0 ? 'border-base-200 border-t' : ''}`}
              onClick={() => setSelectedIntegration(provider)}
              aria-label={label}
            >
              <div className='flex min-w-0 items-center gap-3'>
                <span className='bg-base-200 flex h-9 w-9 shrink-0 items-center justify-center rounded-full'>
                  <Icon className='text-base-content/70' size={20} />
                </span>
                <span className='flex min-w-0 flex-col'>
                  <span className='truncate'>{label}</span>
                  <span className='text-base-content/60 truncate text-sm'>
                    {getStatus(provider)}
                  </span>
                </span>
              </div>
              <MdChevronRight className='text-base-content/50 shrink-0' size={22} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPanel;
