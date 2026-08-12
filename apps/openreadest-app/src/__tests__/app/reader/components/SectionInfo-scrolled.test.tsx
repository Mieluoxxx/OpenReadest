import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SectionInfo from '@/app/reader/components/SectionInfo';

const singleClickConsumed = { current: false };
const scrollToAnchor = vi.fn();
const setHoveredBookKey = vi.fn();

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ appService: { isAndroidApp: false, isMobile: false } }),
}));

vi.mock('@/store/themeStore', () => ({
  useThemeStore: () => ({ systemUIVisible: false, statusBarHeight: 0 }),
}));

vi.mock('@/store/readerStore', () => ({
  useReaderStore: () => ({
    hoveredBookKey: '',
    getView: () => ({ renderer: { scrollToAnchor } }),
    setHoveredBookKey,
  }),
}));

vi.mock('@/store/bookDataStore', () => {
  const state = { getBookData: () => ({ isFixedLayout: false }) };
  return {
    useBookDataStore: <R,>(selector?: (s: typeof state) => R) =>
      selector ? selector(state) : state,
  };
});

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/utils/event', () => ({
  eventDispatcher: {
    dispatchSync: vi.fn(() => singleClickConsumed.current),
  },
}));

const baseProps = {
  bookKey: 'book-1',
  section: 'Chapter 4',
  showDoubleBorder: false,
  isScrolled: true,
  isVertical: false,
  isEink: false,
  horizontalGap: 5,
  contentInsets: { top: 44, right: 10, bottom: 0, left: 10 },
  gridInsets: { top: 0, right: 0, bottom: 0, left: 0 },
};

afterEach(() => {
  cleanup();
  singleClickConsumed.current = false;
  scrollToAnchor.mockClear();
  setHoveredBookKey.mockClear();
});

describe('SectionInfo scrolled-mode chrome (upstream readest)', () => {
  it('sizes the title band to the resolved top margin, not a fixed 44px strip', () => {
    const { container } = render(<SectionInfo {...baseProps} />);
    const strip = container.querySelector('.sectioninfo') as HTMLElement;
    expect(strip.style.top).toBe('0px');
    expect(strip.style.height).toBe('44px');
  });

  it('grows the band with the margin so the title stays glued to the content top', () => {
    const { container } = render(
      <SectionInfo {...baseProps} contentInsets={{ top: 64, right: 10, bottom: 0, left: 10 }} />,
    );
    const strip = container.querySelector('.sectioninfo') as HTMLElement;
    expect(strip.style.top).toBe('0px');
    expect(strip.style.height).toBe('64px');
  });

  it('lifts the band into the notch on a smaller margin and raises its z-index', () => {
    const { container } = render(
      <SectionInfo {...baseProps} contentInsets={{ top: 20, right: 10, bottom: 0, left: 10 }} />,
    );
    const strip = container.querySelector('.sectioninfo') as HTMLElement;
    // band slides up: top = 0 + 20 - 44 -> capped at 0; keeps 44px height
    expect(strip.style.top).toBe('0px');
    expect(strip.style.height).toBe('44px');
    // with an inset the strip overlaps the notch band and must win the paint
    // order (later sibling + explicit z-10)
    const notched = render(
      <SectionInfo
        {...baseProps}
        gridInsets={{ top: 47, right: 0, bottom: 0, left: 0 }}
        contentInsets={{ top: 60, right: 10, bottom: 0, left: 10 }}
      />,
    );
    const lifted = notched.container.querySelector('.sectioninfo') as HTMLElement;
    expect(lifted.style.top).toBe('16px');
    expect(lifted.className).toContain('z-10');
  });

  it('does not raise z-index when the band sits below the notch strip', () => {
    const { container } = render(<SectionInfo {...baseProps} />);
    const strip = container.querySelector('.sectioninfo') as HTMLElement;
    expect(strip.className).not.toContain('z-10');
  });

  it('clicking the notch strip scrolls back to the top in scrolled mode', () => {
    const { container } = render(<SectionInfo {...baseProps} />);
    const notch = container.querySelector('.sectioninfo')!.previousElementSibling as HTMLElement;
    fireEvent.click(notch);
    expect(scrollToAnchor).toHaveBeenCalledWith(0, 'anchor', true);
  });

  it('a consumed iframe click (popup open) suppresses the scroll-to-top', () => {
    singleClickConsumed.current = true;
    const { container } = render(<SectionInfo {...baseProps} />);
    const notch = container.querySelector('.sectioninfo')!.previousElementSibling as HTMLElement;
    fireEvent.click(notch);
    expect(scrollToAnchor).not.toHaveBeenCalled();
  });

  it('clicking the title toggles hover, unless a popup consumed the click', () => {
    const { container } = render(<SectionInfo {...baseProps} />);
    const strip = container.querySelector('.sectioninfo') as HTMLElement;
    fireEvent.click(strip);
    expect(setHoveredBookKey).toHaveBeenCalledWith('book-1');

    singleClickConsumed.current = true;
    fireEvent.click(strip);
    expect(setHoveredBookKey).toHaveBeenCalledTimes(1);
  });
});
