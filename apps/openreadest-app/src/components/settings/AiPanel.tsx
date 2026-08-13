import React, { useEffect, useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { AiConfigRepository } from '@/services/ai/AiConfigRepository';
import { AiErrorCode, testAiConnection } from '@/services/ai/aiClient';
import { AiFormat } from '@/types/settings';
import { LuCheck, LuEye, LuEyeOff, LuX } from 'react-icons/lu';
import Select from '@/components/Select';
import { SettingsPanelPanelProp } from './SettingsDialog';

const AI_FORMATS: AiFormat[] = ['openai-chat', 'openai-responses', 'anthropic', 'deepseek'];

const FORMAT_LABELS: Record<AiFormat, string> = {
  'openai-chat': 'OpenAI Compatible',
  'openai-responses': 'OpenAI Responses',
  anthropic: 'Anthropic Messages',
  deepseek: 'Love From DeepSeek',
};

/** 各格式默认预设（切换联动填入，仍可手动编辑）。 */
const FORMAT_PRESETS: Record<AiFormat, { baseUrl: string; model: string }> = {
  'openai-chat': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5' },
  'openai-responses': { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5' },
  anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5' },
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
};

const buildInitialDrafts = (saved: { baseUrl?: string; model?: string }, savedFormat: AiFormat) => {
  const drafts: Record<AiFormat, { baseUrl: string; model: string }> = {
    'openai-chat': { ...FORMAT_PRESETS['openai-chat'] },
    'openai-responses': { ...FORMAT_PRESETS['openai-responses'] },
    anthropic: { ...FORMAT_PRESETS.anthropic },
    deepseek: { ...FORMAT_PRESETS.deepseek },
  };
  // 已保存配置填入对应格式草稿；其余格式保持预设。
  if (saved.baseUrl || saved.model) {
    drafts[savedFormat] = { baseUrl: saved.baseUrl ?? '', model: saved.model ?? '' };
  }
  return drafts;
};

const AiPanel: React.FC<SettingsPanelPanelProp> = ({ onRegisterReset }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const saved = settings.globalAiSettings ?? {};

  // 已保存 format 优先；未显式配置 format 时一律默认 DeepSeek（含旧配置迁移）。
  const savedFormat: AiFormat = saved.format ?? 'deepseek';

  const [format, setFormat] = useState<AiFormat>(savedFormat);
  const [drafts, setDrafts] = useState<Record<AiFormat, { baseUrl: string; model: string }>>(() =>
    buildInitialDrafts(saved, savedFormat),
  );
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedHasKey, setSavedHasKey] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<{ code: AiErrorCode; message?: string } | null>(null);
  const [testSucceeded, setTestSucceeded] = useState(false);

  const draft = drafts[format];
  const configured = !!draft.baseUrl.trim() && !!draft.model.trim();

  useEffect(() => {
    AiConfigRepository.getConfig().then((config) => {
      // 不预填已存 key（安全），仅记录存在性
      setSavedHasKey(!!config.apiKey);
    });
  }, []);

  const handleReset = () => {
    setDrafts((prev) => ({ ...prev, [format]: { baseUrl: '', model: '' } }));
    setApiKey('');
    setLoadedKey(null);
    setTestError(null);
    setTestSucceeded(false);
    AiConfigRepository.clearApiKey();
    setSavedHasKey(false);
  };

  useEffect(() => {
    onRegisterReset(handleReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  const handleFormatChange = (next: AiFormat) => {
    setFormat(next);
    setTestError(null);
    setTestSucceeded(false);
  };

  const handleDraftChange = (field: 'baseUrl' | 'model', value: string) => {
    setDrafts((prev) => ({ ...prev, [format]: { ...prev[format], [field]: value } }));
    setTestError(null);
    setTestSucceeded(false);
  };

  const handleSave = async () => {
    await AiConfigRepository.saveConfig(
      envConfig,
      draft.baseUrl.trim(),
      draft.model.trim(),
      format,
    );
    if (apiKey) {
      await AiConfigRepository.saveApiKey(apiKey);
    }
    setApiKey('');
    setLoadedKey(null);
    setSavedHasKey(true);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestSucceeded(false);
    try {
      // 输入框为空时回退到已保存的 key（保存后输入框会被清空）
      let key = apiKey || undefined;
      if (!key && savedHasKey) {
        const config = await AiConfigRepository.getConfig();
        key = config.apiKey;
      }
      const result = await testAiConnection({
        format,
        baseUrl: draft.baseUrl.trim(),
        model: draft.model.trim(),
        apiKey: key,
      });
      if (result.ok) {
        setTestSucceeded(true);
      } else if (result.code) {
        setTestError({ code: result.code, message: result.message });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleClearKey = async () => {
    await AiConfigRepository.clearApiKey();
    setSavedHasKey(false);
    setApiKey('');
    setLoadedKey(null);
    setTestError(null);
    setTestSucceeded(false);
  };

  const handleToggleShowKey = async () => {
    if (!showKey && !apiKey && savedHasKey) {
      const config = await AiConfigRepository.getConfig();
      if (config.apiKey) {
        setApiKey(config.apiKey);
        setLoadedKey(config.apiKey);
      }
    }
    if (showKey && loadedKey !== null && apiKey === loadedKey) {
      setApiKey('');
      setLoadedKey(null);
    }
    setShowKey((v) => !v);
  };

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full'>
        <h2 className='mb-2 font-medium'>{_('AI Integration')}</h2>
        <div className='card border-base-200 bg-base-100 border shadow'>
          <div className='divide-base-200 divide-y'>
            <div className='config-item !grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4'>
              <span className=''>{_('Message Format')}</span>
              <Select
                value={format}
                onChange={(e) => handleFormatChange(e.target.value as AiFormat)}
                options={AI_FORMATS.map((f) => ({ value: f, label: _(FORMAT_LABELS[f]) }))}
                aria-label={_('Message Format')}
                className='ms-auto w-[70%] !max-w-none'
              />
            </div>

            <div className='config-item !grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4'>
              <span className=''>{_('Base URL')}</span>
              <input
                type='text'
                className='bg-base-200 h-8 min-h-8 w-full min-w-0 rounded-md border-none px-2 text-sm'
                placeholder={FORMAT_PRESETS[format].baseUrl}
                value={draft.baseUrl}
                onChange={(e) => handleDraftChange('baseUrl', e.target.value)}
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
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestError(null);
                    setTestSucceeded(false);
                  }}
                  autoComplete='off'
                  spellCheck={false}
                />
                <button
                  type='button'
                  className='text-base-content/60 hover:text-base-content absolute inset-y-0 end-0 flex w-8 items-center justify-center'
                  aria-label={showKey ? _('Hide API key') : _('Show API key')}
                  title={showKey ? _('Hide API key') : _('Show API key')}
                  onClick={handleToggleShowKey}
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
                placeholder={FORMAT_PRESETS[format].model}
                value={draft.model}
                onChange={(e) => handleDraftChange('model', e.target.value)}
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
        {testError && (
          <p className='text-error mt-2 break-all font-mono text-xs' role='alert'>
            [{testError.code}]{testError.message ? ` ${testError.message}` : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default AiPanel;
