import { describe, expect, it, vi } from 'vitest';
import {
  appendTranslationFailure,
  hasTranslationTarget,
  shouldSkipTranslationText,
} from './translationDom';

describe('translation DOM state', () => {
  it('skips image placeholders but keeps normal prose', () => {
    expect(shouldSkipTranslationText('[Image-#1]')).toBe(true);
    expect(shouldSkipTranslationText('[Image-23]')).toBe(true);
    expect(shouldSkipTranslationText('Architecture enables change.')).toBe(false);
  });

  it('appends at most one failure control per source element', () => {
    const source = document.createElement('p');
    const retry = vi.fn();

    const first = appendTranslationFailure(source, 'Translation failed', retry);
    const second = appendTranslationFailure(source, 'Translation failed', retry);

    expect(first).toBe(second);
    expect(source.querySelectorAll('.translation-failed')).toHaveLength(1);
    expect(hasTranslationTarget(source)).toBe(true);
  });

  it('runs the retry callback and removes the failure control', () => {
    const source = document.createElement('p');
    const retry = vi.fn();
    const failure = appendTranslationFailure(source, 'Translation failed', retry);

    failure.click();

    expect(retry).toHaveBeenCalledTimes(1);
    expect(source.querySelector('.translation-failed')).toBeNull();
  });
});
