'use client';

import clsx from 'clsx';
import React, { useState } from 'react';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import {
  CloudConflictResolutionStrategy,
  CloudProfile,
  S3CloudProfile,
  WebDavCloudProfile,
} from '@/services/cloud/models';

type CloudProfileFormProps = {
  profile: CloudProfile;
  embedded: boolean;
  onChange: (profile: CloudProfile) => void;
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className='flex min-w-0 flex-col gap-1'>
    <label className='text-sm'>{label}</label>
    {children}
  </div>
);

export const CloudProfileForm = ({ profile, embedded, onChange }: CloudProfileFormProps) => {
  const _ = useTranslation();
  const [showSecretKey, setShowSecretKey] = useState(false);

  const updateWebDavConfig = (patch: Partial<WebDavCloudProfile['config']>) => {
    if (profile.provider !== 'webdav') return;
    onChange({ ...profile, config: { ...profile.config, ...patch } });
  };

  const updateS3Config = (patch: Partial<S3CloudProfile['config']>) => {
    if (profile.provider !== 's3') return;
    const endpointChanged = patch.endpoint !== undefined && patch.endpoint !== profile.config.endpoint;
    const bucketChanged =
      patch.bucketName !== undefined && patch.bucketName !== profile.config.bucketName;
    onChange({
      ...profile,
      config: {
        ...profile.config,
        ...patch,
        addressingStyle:
          endpointChanged || bucketChanged ? undefined : profile.config.addressingStyle,
      },
    });
  };

  return (
    <>
      <div className={clsx('grid grid-cols-1 gap-3', !embedded && 'sm:grid-cols-2')}>
        <Field label={_('备注名')}>
          <input
            className='input input-bordered w-full'
            value={profile.name}
            onChange={(event) => onChange({ ...profile, name: event.target.value })}
            placeholder={profile.provider === 's3' ? 'S3_1' : 'WebDAV_1'}
          />
        </Field>

        {profile.provider === 'webdav' ? (
          <>
            <Field label={_('服务器地址')}>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.serverUrl}
                onChange={(event) => updateWebDavConfig({ serverUrl: event.target.value })}
                placeholder='https://dav.example.com'
              />
            </Field>
            <Field label={_('远端路径')}>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.remotePath}
                onChange={(event) => updateWebDavConfig({ remotePath: event.target.value })}
                placeholder='/remote/path'
              />
            </Field>
            <Field label={_('用户名')}>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.username}
                onChange={(event) => updateWebDavConfig({ username: event.target.value })}
              />
            </Field>
            <Field label={_('密码')}>
              <input
                className='input input-bordered w-full'
                type='password'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.password}
                onChange={(event) => updateWebDavConfig({ password: event.target.value })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label='Endpoint'>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.endpoint}
                onChange={(event) => updateS3Config({ endpoint: event.target.value })}
                placeholder='https://s3.example.com'
              />
            </Field>
            <Field label='Region'>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.region}
                onChange={(event) => updateS3Config({ region: event.target.value })}
                placeholder='us-east-1'
              />
            </Field>
            <Field label='Access Key'>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.accessKeyId}
                autoComplete='off'
                onChange={(event) => updateS3Config({ accessKeyId: event.target.value })}
              />
            </Field>
            <Field label='Secret Key'>
              <div className='relative'>
                <input
                  className='input input-bordered w-full pe-11'
                  type={showSecretKey ? 'text' : 'password'}
                  autoCapitalize='none'
                  autoCorrect='off'
                  spellCheck={false}
                  value={profile.config.secretAccessKey}
                  autoComplete='new-password'
                  onChange={(event) =>
                    updateS3Config({ secretAccessKey: event.target.value })
                  }
                />
                <button
                  type='button'
                  className='btn btn-ghost btn-sm btn-circle absolute end-1 top-1/2 -translate-y-1/2'
                  aria-label={showSecretKey ? _('隐藏 Secret Key') : _('显示 Secret Key')}
                  title={showSecretKey ? _('隐藏 Secret Key') : _('显示 Secret Key')}
                  onClick={() => setShowSecretKey((visible) => !visible)}
                >
                  {showSecretKey ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </Field>
            <Field label='Bucket Name'>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.bucketName}
                onChange={(event) => updateS3Config({ bucketName: event.target.value })}
              />
            </Field>
            <Field label='Remote Prefix'>
              <input
                className='input input-bordered w-full'
                autoCapitalize='none'
                autoCorrect='off'
                spellCheck={false}
                value={profile.config.remotePrefix}
                onChange={(event) => updateS3Config({ remotePrefix: event.target.value })}
                placeholder='books'
              />
            </Field>
          </>
        )}
      </div>

      <div
        className={clsx(
          'flex flex-col gap-3',
          !embedded && 'sm:flex-row sm:items-center sm:justify-between',
        )}
      >
        {profile.provider === 'webdav' ? (
          <div className={clsx('flex gap-3', embedded ? 'flex-col' : 'items-center')}>
            <label className='flex items-center gap-2'>
              <input
                type='checkbox'
                className='checkbox checkbox-sm'
                checked={!!profile.config.allowInsecureHttp}
                onChange={(event) =>
                  updateWebDavConfig({ allowInsecureHttp: event.target.checked })
                }
              />
              <span className='text-sm'>{_('允许 HTTP（不安全）')}</span>
            </label>
            <label className='flex items-center gap-2'>
              <input
                type='checkbox'
                className='checkbox checkbox-sm'
                checked={!!profile.config.allowInsecureTls}
                onChange={(event) =>
                  updateWebDavConfig({ allowInsecureTls: event.target.checked })
                }
              />
              <span className='text-sm'>{_('允许不受信任证书')}</span>
            </label>
          </div>
        ) : (
          <span />
        )}
        <div className={clsx('flex gap-2', embedded ? 'flex-col items-stretch' : 'items-center')}>
          <span className='text-sm'>{_('冲突策略')}</span>
          <select
            className={clsx('select select-bordered select-sm', embedded && 'w-full')}
            value={profile.conflictStrategy}
            onChange={(event) =>
              onChange({
                ...profile,
                conflictStrategy: event.target.value as CloudConflictResolutionStrategy,
              })
            }
          >
            <option value='manual'>{_('手动处理')}</option>
            <option value='newest'>{_('时间戳优先')}</option>
            <option value='local'>{_('本地优先')}</option>
            <option value='remote'>{_('云端优先')}</option>
          </select>
        </div>
      </div>
    </>
  );
};

export default CloudProfileForm;

