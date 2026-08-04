import React, { useEffect, useState } from 'react';
import { MdChevronRight, MdCloud } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { loadWebDavStoreFromStorage, useWebDavStore } from '@/store/webdavStore';
import WebDavCenterWindow from '@/app/library/components/WebDavCenterWindow';

const IntegrationsPanel: React.FC = () => {
  const _ = useTranslation();
  const [selectedIntegration, setSelectedIntegration] = useState(false);
  const profiles = useWebDavStore((state) => state.profiles);
  const activeProfileId = useWebDavStore((state) => state.activeProfileId);
  const restore = useWebDavStore((state) => state.restore);

  useEffect(() => {
    restore(loadWebDavStoreFromStorage());
  }, [restore]);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const status = activeProfile?.name || _('Not configured');

  if (selectedIntegration) {
    return (
      <div className='my-4 w-full space-y-6'>
        <div className='w-full'>
          <h2 className='mb-2 font-medium'>
            <button
              type='button'
              className='text-base-content/80 hover:text-base-content'
              onClick={() => setSelectedIntegration(false)}
            >
              {_('Integrations')}
            </button>
            <span className='text-base-content/50 px-2'>›</span>
            {_('WebDAV')}
          </h2>
          <WebDavCenterWindow embedded />
        </div>
      </div>
    );
  }

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>{_('Cloud Sync')}</h2>
        <div className='card border-base-200 bg-base-100 border shadow'>
          <button
            type='button'
            className='config-item w-full gap-3 text-left'
            onClick={() => setSelectedIntegration(true)}
            aria-label={_('WebDAV')}
          >
            <div className='flex min-w-0 items-center gap-3'>
              <span className='bg-base-200 flex h-9 w-9 shrink-0 items-center justify-center rounded-full'>
                <MdCloud className='text-base-content/70' size={20} />
              </span>
              <span className='flex min-w-0 flex-col'>
                <span className='truncate'>{_('WebDAV')}</span>
                <span className='text-base-content/60 truncate text-sm'>{status}</span>
              </span>
            </div>
            <MdChevronRight className='text-base-content/50 shrink-0' size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPanel;
