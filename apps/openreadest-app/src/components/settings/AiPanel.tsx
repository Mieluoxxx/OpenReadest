import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { AiConfigRepository } from '@/services/ai/AiConfigRepository';
import { AiErrorCode, testAiConnection } from '@/services/ai/aiClient';
import { LuCheck, LuEye, LuEyeOff } from 'react-icons/lu';
import { SettingsPanelPanelProp } from './SettingsDialog';

const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  NOT_CONFIGURED: 'Please configure the AI service first.',
  AUTH_FAILED: 'API key is invalid or expired.',
  ENDPOINT_OR_MODEL_ERROR: 'Request rejected by the service (Base URL or model may be incorrect).',
  RATE_LIMITED: 'Too many requests or quota exhausted.',
  SERVER_ERROR: 'AI service is temporarily unavailable.',
  TIMEOUT: 'Request timed out, please retry.',
  BAD_RESPONSE: 'Service is not compatible with the OpenAI protocol.',
  NETWORK: 'Network error, please check your connection.',
};

const AiPanel: React.FC<SettingsPanelPanelProp> = ({ onRegisterReset }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const saved = settings.globalAiSettings ?? { baseUrl: '', model: '' };

  const [baseUrl, setBaseUrl] = useState(saved.baseUrl);
  const [model, setModel] = useState(saved.model);
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
            <div className='config-item'>
              <span className=''>{_('Base URL')}</span>
              <input
                type='text'
                className='bg-base-200 h-8 min-h-8 rounded-md border-none px-2 text-sm'
                placeholder='https://api.openai.com/v1'
                value={baseUrl}
                onChange={(e) => handleConfigChange(setBaseUrl, e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className='config-item'>
              <span className=''>{_('Model')}</span>
              <input
                type='text'
                className='bg-base-200 h-8 min-h-8 rounded-md border-none px-2 text-sm'
                placeholder='gpt-4o-mini'
                value={model}
                onChange={(e) => handleConfigChange(setModel, e.target.value)}
                spellCheck={false}
              />
            </div>

            <div className='config-item'>
              <span className=''>{_('API Key (optional)')}</span>
              <div className='relative'>
                <input
                  type={showKey ? 'text' : 'password'}
                  className='bg-base-200 h-8 min-h-8 rounded-md border-none px-2 pe-8 text-sm'
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

            <div className='config-item'>
              <span className=''>{_('Test Connection')}</span>
              <div className='flex items-center gap-2'>
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
              </div>
            </div>

            <div className='config-item'>
              <span className=''>{_('Save / Clear')}</span>
              <div className='flex items-center gap-2'>
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

        <div className='mt-3 space-y-1 text-sm'>
          <p className={clsx('text-base-content/60', 'font-medium')}>
            {configured ? _('AI service configured.') : _('AI service not configured.')}
          </p>
          {testError && <p className='text-red-600'>{_(AI_ERROR_MESSAGES[testError])}</p>}
        </div>
      </div>
    </div>
  );
};

export default AiPanel;
