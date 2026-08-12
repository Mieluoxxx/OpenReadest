import { BookConfig, BookSearchConfig, ViewSettings } from '@/types/book';
import { normalizeViewSettings } from '@/utils/viewSettings';

export const serializeConfig = (
  config: BookConfig,
  globalViewSettings: ViewSettings,
  defaultSearchConfig: BookSearchConfig,
): string => {
  config = JSON.parse(JSON.stringify(config));
  const viewSettings = config.viewSettings as Partial<ViewSettings>;
  const searchConfig = config.searchConfig as Partial<BookSearchConfig>;
  config.viewSettings = Object.entries(viewSettings).reduce(
    (acc: Partial<Record<keyof ViewSettings, unknown>>, [key, value]) => {
      if (globalViewSettings[key as keyof ViewSettings] !== value) {
        acc[key as keyof ViewSettings] = value;
      }
      return acc;
    },
    {} as Partial<Record<keyof ViewSettings, unknown>>,
  ) as Partial<ViewSettings>;
  config.searchConfig = Object.entries(searchConfig).reduce(
    (acc: Partial<Record<keyof BookSearchConfig, unknown>>, [key, value]) => {
      if (defaultSearchConfig[key as keyof BookSearchConfig] !== value) {
        acc[key as keyof BookSearchConfig] = value;
      }
      return acc;
    },
    {} as Partial<BookSearchConfig>,
  ) as Partial<BookSearchConfig>;

  return JSON.stringify(config);
};

export const deserializeConfig = (
  str: string,
  globalViewSettings: ViewSettings,
  defaultSearchConfig: BookSearchConfig,
): BookConfig => {
  const config = JSON.parse(str) as BookConfig;
  const { viewSettings, searchConfig } = config;
  // Normalize legacy scroll fields (e.g. continuousScroll -> noContinuousScroll)
  // at the hydration boundary so downstream consumers only see the new model.
  // The raw per-book object is passed as the source so an explicit legacy
  // value overrides the global default of the new field.
  config.viewSettings = normalizeViewSettings(
    { ...globalViewSettings, ...viewSettings },
    viewSettings,
  );
  config.searchConfig = { ...defaultSearchConfig, ...searchConfig };
  config.updatedAt ??= Date.now();
  return config;
};

export const compressConfig = (
  config: BookConfig,
  globalViewSettings: ViewSettings,
  defaultSearchConfig: BookSearchConfig,
): string => {
  return JSON.parse(serializeConfig(config, globalViewSettings, defaultSearchConfig));
};
