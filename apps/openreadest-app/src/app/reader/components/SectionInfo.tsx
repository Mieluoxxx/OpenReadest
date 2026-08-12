import clsx from 'clsx';
import React from 'react';
import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useTranslation } from '@/hooks/useTranslation';
import { eventDispatcher } from '@/utils/event';
import { getHeaderBandGeometry } from '@/utils/insets';

interface SectionInfoProps {
  bookKey: string;
  section?: string;
  showDoubleBorder: boolean;
  isScrolled: boolean;
  isVertical: boolean;
  isEink: boolean;
  horizontalGap: number;
  contentInsets: Insets;
  gridInsets: Insets;
}

const SectionInfo: React.FC<SectionInfoProps> = ({
  bookKey,
  section,
  showDoubleBorder,
  isScrolled,
  isVertical,
  isEink,
  horizontalGap,
  contentInsets,
  gridInsets,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { hoveredBookKey, getView, setHoveredBookKey } = useReaderStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const { getBookData } = useBookDataStore();
  const bookData = getBookData(bookKey);
  const topInset = Math.max(
    gridInsets.top,
    appService?.isAndroidApp && systemUIVisible ? statusBarHeight / 2 : 0,
  );
  // The title band is glued to the renderer's content top (the resolved top
  // margin, floored at 44px by the fork's moreTopInset): at smaller margins it
  // lifts into the notch instead of floating over the text (#5303).
  const band = getHeaderBandGeometry(topInset, contentInsets.top - gridInsets.top, 44);

  const handleNotchClick = () => {
    if (eventDispatcher.dispatchSync('iframe-single-click')) return;
    // In scrolled mode the notch strip is the reader's "back to top" target.
    if (isScrolled) {
      getView(bookKey)?.renderer.scrollToAnchor?.(0, 'anchor', true);
    }
  };

  const handleSectionClick = () => {
    if (eventDispatcher.dispatchSync('iframe-single-click')) return;
    setHoveredBookKey(bookKey);
  };

  return (
    <>
      <div
        className={clsx(
          'absolute left-0 right-0 top-0 z-10',
          // Fixed-layout pages fill the screen edge to edge in scrolled mode and
          // their chrome overlays the page; the opaque band would cover the
          // document at the camera hole / status bar (upstream readest #5503).
          isScrolled && !isVertical && !bookData?.isFixedLayout && 'bg-base-100',
        )}
        role='none'
        tabIndex={-1}
        onClick={handleNotchClick}
        style={{
          height: `${topInset}px`,
        }}
      />
      <div
        className={clsx(
          'sectioninfo absolute flex items-center overflow-hidden font-sans',
          // A lifted band overlaps the notch strip (z-10) and must win as the
          // later sibling — z-auto would lose to any positive z. Only when
          // lifted: an unconditional z-10 also covers the desktop HeaderBar
          // (z-auto wrapper, so even its z-20 button groups stay below) and
          // makes the toolbar unclickable.
          !isVertical && band.top < topInset && 'z-10',
          isEink
            ? 'text-sm font-normal'
            : bookData?.isFixedLayout
              ? 'text-xs font-light text-white/75 mix-blend-difference'
              : 'text-neutral-content text-xs font-light',
          isVertical ? 'writing-vertical-rl max-h-[85%]' : 'top-0',
          // Same edge-to-edge rationale as the notch band above: fixed-layout
          // pages scroll under the chrome instead of reserving a band.
          isScrolled && !isVertical && !bookData?.isFixedLayout && 'bg-base-100',
        )}
        role='none'
        tabIndex={-1}
        onClick={handleSectionClick}
        style={
          isVertical
            ? {
                top: `${(contentInsets.top - gridInsets.top) * 1.5}px`,
                right: showDoubleBorder
                  ? `calc(${contentInsets.right}px)`
                  : `calc(${Math.max(0, contentInsets.right - 32)}px)`,
                width: showDoubleBorder ? '32px' : `${contentInsets.right}px`,
                height: `calc(100% - ${contentInsets.top + contentInsets.bottom}px)`,
              }
            : {
                top: `${band.top}px`,
                paddingInline: `calc(${horizontalGap / 2}% + ${contentInsets.left / 2}px)`,
                width: '100%',
                height: `${band.height}px`,
              }
        }
      >
        <span
          aria-label={section ? _('Section Title') + `: ${section}` : ''}
          className={clsx(
            'text-center',
            isVertical ? '' : 'line-clamp-1',
            !isVertical &&
              (hoveredBookKey == bookKey || (hoveredBookKey && appService?.isMobile)) &&
              'hidden',
          )}
        >
          {section || ''}
        </span>
      </div>
    </>
  );
};

export default SectionInfo;
