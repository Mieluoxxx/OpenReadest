const IMAGE_PLACEHOLDER_RE = /^\[(?:image|figure)(?:-?#?\d+)?\]$/i;

const findDirectChildByClass = (element: HTMLElement, className: string): HTMLElement | null => {
  return (
    (Array.from(element.children).find((child) => child.classList.contains(className)) as
      HTMLElement | undefined) ?? null
  );
};

export const shouldSkipTranslationText = (text: string): boolean => {
  const trimmed = text.trim();
  return !trimmed || IMAGE_PLACEHOLDER_RE.test(trimmed);
};

export const hasTranslationTarget = (element: HTMLElement): boolean => {
  return (
    element.classList.contains('translation-target') ||
    findDirectChildByClass(element, 'translation-target') !== null
  );
};

export const appendTranslationFailure = (
  source: HTMLElement,
  message: string,
  onRetry: () => void,
): HTMLElement => {
  const existing = findDirectChildByClass(source, 'translation-failed');
  if (existing) return existing;

  const failure = source.ownerDocument.createElement('font');
  failure.className = 'translation-target translation-failed';
  failure.setAttribute('translation-element-mark', '1');
  failure.setAttribute('role', 'button');
  failure.setAttribute('tabindex', '0');
  failure.setAttribute('title', message);
  failure.textContent = message;

  const retry = () => {
    failure.remove();
    onRetry();
  };
  failure.addEventListener('click', retry, { once: true });
  failure.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    retry();
  });
  source.appendChild(failure);
  return failure;
};
