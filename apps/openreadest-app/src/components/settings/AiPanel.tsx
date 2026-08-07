import React, { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { AiConfigRepository } from '@/services/ai/AiConfigRepository';
import { AiErrorCode, testAiConnection } from '@/services/ai/aiClient';
import { LuCheck, LuEye, LuEyeOff, LuX } from 'react-icons/lu';
import { SettingsPanelPanelProp } from './SettingsDialog';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-v4-flash';

const AiPanel: React.FC<SettingsPanelPanelProp> = ({ onRegisterReset }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const saved = settings.globalAiSettings ?? {};

  const [baseUrl, setBaseUrl] = useState(saved.baseUrl ?? DEFAULT_BASE_URL);
  const [model, setModel] = useState(saved.model ?? DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedHasKey, setSavedHasKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<AiErrorCode | null>(null);
  const [testSucceeded, setTestSucceeded] = useState(false);

  useEffect(() => {
    AiConfigRepository.getConfig().then((config) => {
      // 不预填已存 key（安全），仅记录存在性
      setSavedHasKey(!!config.apiKey);
    });
  }, []);

  const configured = !!baseUrl.trim() && !!model.trim();

  const handleReset = () => {
    setBaseUrl('');
    setModel('');
    setApiKey('');
    setTestError(null);
    setTestSucceeded(false);
    AiConfigRepository.clearApiKey();
    setSavedHasKey(false);
  };

  useEffect(() => {
    onRegisterReset(handleReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    await AiConfigRepository.saveConfig(envConfig, baseUrl.trim(), model.trim());
    if (apiKey) {
      await AiConfigRepository.saveApiKey(apiKey);
    }
    setApiKey('');
    setSavedHasKey(true);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestSucceeded(false);
    try {
      const result = await testAiConnection({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKey: apiKey || undefined,
      });
      if (result.ok) {
        setTestSucceeded(true);
      } else if (result.code) {
        setTestError(result.code);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleClearKey = async () => {
    await AiConfigRepository.clearApiKey();
    setSavedHasKey(false);
    setApiKey('');
    setTestError(null);
    setTestSucceeded(false);
  };

  const handleConfigChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setTestError(null);
    setTestSucceeded(false);
  };

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>{_('AI Integration')}</h2>
        <div className='card border-base-200 bg-base-100 border shadow'>
          <div className='divide-base-200 divide-y'>
            <div className='config-item !grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4'>
              <span className=''>{_('Base URL')}</span>
              <input
                type='text'
                className='bg-base-200 h-8 min-h-8 w-full min-w-0 rounded-md border-none px-2 text-sm'
                placeholder={DEFAULT_BASE_URL}
                value={baseUrl}
                onChange={(e) => handleConfigChange(setBaseUrl, e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className='config-item !grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4'>
              <span className=''>{_('API Key (optional)')}</span>
              <div className='relative w-full min-w-0'>
                <input
                  type={showKey ? 'text' : 'password'}
                  className='bg-base-200 h-8 min-h-8 w-full min-w-0 rounded-md border-none px-2 pe-8 text-sm'
                  placeholder={
                    savedHasKey ? _('Saved, enter to replace') : _('Leave empty for no auth')
                  }
                  value={apiKey}
                  onChange={(e) => handleConfigChange(setApiKey, e.target.value)}
                  autoComplete='off'
                  spellCheck={false}
                />
                <button
                  type='button'
                  className='text-base-content/60 hover:text-base-content absolute inset-y-0 end-0 flex w-8 items-center justify-center'
                  aria-label={showKey ? _('Hide API key') : _('Show API key')}
                  title={showKey ? _('Hide API key') : _('Show API key')}
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? <LuEyeOff aria-hidden='true' /> : <LuEye aria-hidden='true' />}
                </button>
              </div>
            </div>

            <div className='config-item !grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4'>
              <span className=''>{_('Model Name')}</span>
              <input
                type='text'
                className='bg-base-200 h-8 min-h-8 w-full min-w-0 rounded-md border-none px-2 text-sm'
                placeholder={DEFAULT_MODEL}
                value={model}
                onChange={(e) => handleConfigChange(setModel, e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className='config-item'>
              <span className=''>{_('Save / Test / Clear')}</span>
              <div className='flex flex-wrap items-center justify-end gap-2'>
                {testError && <LuX className='text-error' aria-label={_('Connection failed')} />}
                {testSucceeded && (
                  <LuCheck className='text-success' aria-label={_('Connection successful')} />
                )}
                <button
                  type='button'
                  className='btn btn-primary btn-sm'
                  disabled={testing || !configured}
                  onClick={handleTest}
                >
                  {testing ? _('Testing...') : _('Test')}
                </button>
                <button type='button' className='btn btn-primary btn-sm' onClick={handleSave}>
                  {_('Save')}
                </button>
                <button
                  type='button'
                  className='btn btn-ghost btn-sm'
                  disabled={!savedHasKey && !apiKey}
                  onClick={handleClearKey}
                >
                  {_('Clear API Key')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiPanel;
