import React, { useEffect } from 'react';
import { MdChevronRight, MdCloud } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { loadWebDavStoreFromStorage, useWebDavStore } from '@/store/webdavStore';
import { setWebDavCenterVisible } from '@/app/library/components/WebDavCenterWindow';

const IntegrationsPanel: React.FC = () => {
  const _ = useTranslation();
  const profiles = useWebDavStore((state) => state.profiles);
  const activeProfileId = useWebDavStore((state) => state.activeProfileId);
  const restore = useWebDavStore((state) => state.restore);

  useEffect(() => {
    restore(loadWebDavStoreFromStorage());
  }, [restore]);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const status = activeProfile?.name || _('Not configured');

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>{_('Cloud Sync')}</h2>
        <div className='card border-base-200 bg-base-100 border shadow'>
          <button
            type='button'
            className='config-item w-full text-left'
            onClick={() => setWebDavCenterVisible(true)}
            aria-label={_('WebDAV')}
          >
            <span className='flex min-w-0 items-center gap-3'>
              <span className='bg-base-200 flex h-9 w-9 shrink-0 items-center justify-center rounded-full'>
                <MdCloud className='text-base-content/70' size={20} />
              </span>
              <span className='flex min-w-0 flex-col'>
                <span className='truncate text-base'>{_('WebDAV')}</span>
                <span className='text-base-content/60 truncate text-sm'>{status}</span>
              </span>
            </span>
            <MdChevronRight className='text-base-content/50 shrink-0' size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPanel;
