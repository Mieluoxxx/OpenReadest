import clsx from 'clsx';
import React, { useEffect } from 'react';
import { useState } from 'react';
import { BiMoon, BiSun } from 'react-icons/bi';
import { TbSunMoon } from 'react-icons/tb';
import { MdZoomOut, MdZoomIn, MdCheck } from 'react-icons/md';
import { IoMdExpand } from 'react-icons/io';
import { TbArrowAutofitWidth } from 'react-icons/tb';
import { TbColumns1, TbColumns2 } from 'react-icons/tb';
import { TbCarouselVertical, TbCarouselHorizontal } from 'react-icons/tb';

import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, ZOOM_STEP } from '@/services/constants';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { getStyles } from '@/utils/style';
import { getMaxInlineSize } from '@/utils/config';
import { saveViewSettings } from '@/helpers/settings';
import { eventDispatcher } from '@/utils/event';
import { tauriHandleToggleFullScreen } from '@/utils/window';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';

interface ViewMenuProps {
  bookKey: string;
  setIsDropdownOpen?: (open: boolean) => void;
}

const ViewMenu: React.FC<ViewMenuProps> = ({ bookKey, setIsDropdownOpen }) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { getBookData } = useBookDataStore();
  const { setSettingsDialogOpen, setSettingsDialogBookKey } = useSettingsStore();
  const { getView, getViewSettings, setViewSettings, getViewState } = useReaderStore();
  const bookData = getBookData(bookKey)!;
  const viewSettings = getViewSettings(bookKey)!;
  const viewState = getViewState(bookKey);

  const { themeMode, isDarkMode, setThemeMode } = useThemeStore();
  const [isScrolledMode, setScrolledMode] = useState(viewSettings!.scrolled);
  const [scrolledDirection, setScrolledDirection] = useState(
    viewSettings!.scrolledDirection ?? 'vertical',
  );
  const [zoomLevel, setZoomLevel] = useState(viewSettings!.zoomLevel!);
  const [zoomMode, setZoomMode] = useState(viewSettings!.zoomMode!);
  const [spreadMode, setSpreadMode] = useState(viewSettings!.spreadMode!);
  const [keepCoverSpread, setKeepCoverSpread] = useState(viewSettings!.keepCoverSpread!);
  const [invertImgColorInDark, setInvertImgColorInDark] = useState(
    viewSettings!.invertImgColorInDark,
  );

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM_LEVEL));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM_LEVEL));
  const resetZoom = () => setZoomLevel(100);
  const toggleScrolledMode = () => setScrolledMode(!isScrolledMode);

  const toggleAutoScroll = () => {
    setIsDropdownOpen?.(false);
    eventDispatcher.dispatch('autoscroll-toggle', { bookKey });
  };

  const openFontLayoutMenu = () => {
    setIsDropdownOpen?.(false);
    setSettingsDialogBookKey(bookKey);
    setSettingsDialogOpen(true);
  };

  const cycleThemeMode = () => {
    const nextMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
    setThemeMode(nextMode);
  };

  const handleFullScreen = () => {
    tauriHandleToggleFullScreen();
    setIsDropdownOpen?.(false);
  };

  useEffect(() => {
    if (isScrolledMode === viewSettings!.scrolled) return;
    viewSettings!.scrolled = isScrolledMode;
    getView(bookKey)?.renderer.setAttribute('flow', isScrolledMode ? 'scrolled' : 'paginated');
    getView(bookKey)?.renderer.setAttribute(
      'max-inline-size',
      `${getMaxInlineSize(viewSettings)}px`,
    );
    getView(bookKey)?.renderer.setStyles?.(getStyles(viewSettings!));
    setViewSettings(bookKey, viewSettings!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrolledMode]);

  // Per-book persistence only (skipGlobal): scrolledDirection is meaningful
  // solely for fixed-layout (pre-paginated) books, so it must never bleed into
  // the global view settings of reflowable books (upstream readest #5485). The
  // renderer attribute is applied by FoliateViewer (single owner), which
  // re-runs its margin/gap effect on viewSettings.scrolledDirection changes.
  useEffect(() => {
    if (scrolledDirection === (viewSettings!.scrolledDirection ?? 'vertical')) return;
    saveViewSettings(envConfig, bookKey, 'scrolledDirection', scrolledDirection, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrolledDirection]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'zoomLevel', zoomLevel, true, true);
    if (bookData.bookDoc?.rendition?.layout === 'pre-paginated') {
      getView(bookKey)?.renderer.setAttribute('scale-factor', zoomLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomLevel]);

  useEffect(() => {
    if (invertImgColorInDark === viewSettings.invertImgColorInDark) return;
    saveViewSettings(envConfig, bookKey, 'invertImgColorInDark', invertImgColorInDark, true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invertImgColorInDark]);

  useEffect(() => {
    if (zoomMode === viewSettings.zoomMode) return;
    viewSettings.zoomMode = zoomMode;
    getView(bookKey)?.renderer.setAttribute('zoom', zoomMode);
    setViewSettings(bookKey, viewSettings);
    saveViewSettings(envConfig, bookKey, 'zoomMode', zoomMode, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomMode]);

  useEffect(() => {
    if (spreadMode === viewSettings.spreadMode) return;
    viewSettings.spreadMode = spreadMode;
    getView(bookKey)?.renderer.setAttribute('spread', spreadMode);
    setViewSettings(bookKey, viewSettings);
    saveViewSettings(envConfig, bookKey, 'spreadMode', spreadMode, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadMode]);

  useEffect(() => {
    if (keepCoverSpread === viewSettings.keepCoverSpread) return;
    if (!bookData?.bookDoc?.sections?.length) return;
    viewSettings.keepCoverSpread = keepCoverSpread;
    const coverSide = bookData.bookDoc.dir === 'rtl' ? 'right' : 'left';
    bookData.bookDoc.sections[0]!.pageSpread = keepCoverSpread ? '' : coverSide;
    getView(bookKey)?.renderer.setAttribute('spread', spreadMode);
    setViewSettings(bookKey, viewSettings);
    saveViewSettings(envConfig, bookKey, 'keepCoverSpread', keepCoverSpread, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepCoverSpread]);

  return (
    <Menu
      className={clsx(
        'view-menu dropdown-content dropdown-right no-triangle z-20 mt-1 border',
        'bgcolor-base-200 shadow-2xl',
      )}
      style={{
        maxWidth: `${window.innerWidth - 40}px`,
        marginRight: window.innerWidth < 640 ? '-36px' : '0px',
      }}
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      {bookData.bookDoc?.rendition?.layout === 'pre-paginated' && (
        <>
          <div
            title={_('Zoom Level')}
            className={clsx('flex items-center justify-between rounded-md')}
          >
            <button
              title={_('Zoom Out')}
              onClick={zoomOut}
              className={clsx(
                'hover:bg-base-300 text-base-content rounded-full p-2',
                zoomLevel <= MIN_ZOOM_LEVEL && 'btn-disabled text-gray-400',
              )}
            >
              <MdZoomOut />
            </button>
            <button
              title={_('Reset Zoom')}
              className={clsx(
                'hover:bg-base-300 text-base-content h-8 min-h-8 w-[50%] rounded-md p-1 text-center',
              )}
              onClick={resetZoom}
            >
              {Number(zoomLevel.toFixed(1))}%
            </button>
            <button
              title={_('Zoom In')}
              onClick={zoomIn}
              className={clsx(
                'hover:bg-base-300 text-base-content rounded-full p-2',
                zoomLevel >= MAX_ZOOM_LEVEL && 'btn-disabled text-gray-400',
              )}
            >
              <MdZoomIn />
            </button>
          </div>

          <>
            <div
              title={_('Zoom Mode')}
              className={clsx('my-2 flex items-center justify-between rounded-md')}
            >
              <button
                title={_('Single Page')}
                onClick={() => {
                  setSpreadMode('none');
                  if (isScrolledMode) setScrolledMode(false);
                }}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  !isScrolledMode && spreadMode === 'none' && 'bg-base-300/75',
                )}
              >
                <TbColumns1 />
              </button>
              <button
                title={_('Auto Spread')}
                onClick={() => {
                  setSpreadMode('auto');
                  if (isScrolledMode) setScrolledMode(false);
                }}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  !isScrolledMode && spreadMode === 'auto' && 'bg-base-300/75',
                )}
              >
                <TbColumns2 />
              </button>
              <button
                title={_('Vertical Scrolling')}
                onClick={() => {
                  setScrolledDirection('vertical');
                  if (!isScrolledMode) setScrolledMode(true);
                }}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  isScrolledMode && scrolledDirection === 'vertical' && 'bg-base-300/75',
                )}
              >
                <TbCarouselVertical />
              </button>
              <button
                title={_('Horizontal Scrolling')}
                onClick={() => {
                  setScrolledDirection('horizontal');
                  if (!isScrolledMode) setScrolledMode(true);
                }}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  isScrolledMode && scrolledDirection === 'horizontal' && 'bg-base-300/75',
                )}
              >
                <TbCarouselHorizontal />
              </button>
              <div className='bg-base-300 mx-2 h-6 w-[1px]' />
              <button
                title={_('Fit Page')}
                onClick={setZoomMode.bind(null, 'fit-page')}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  zoomMode === 'fit-page' && 'bg-base-300/75',
                )}
              >
                <IoMdExpand />
              </button>
              <button
                title={_('Fit Width')}
                onClick={setZoomMode.bind(null, 'fit-width')}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  zoomMode === 'fit-width' && 'bg-base-300/75',
                )}
              >
                <TbArrowAutofitWidth />
              </button>
            </div>

            <MenuItem
              label={_('Separate Cover Page')}
              Icon={keepCoverSpread ? MdCheck : undefined}
              onClick={() => setKeepCoverSpread(!keepCoverSpread)}
              disabled={spreadMode === 'none'}
            />
          </>
          <hr aria-hidden='true' className='border-base-300 my-1' />
        </>
      )}

      <MenuItem label={_('Font & Layout')} shortcut='Shift+F' onClick={openFontLayoutMenu} />

      {!bookData.isFixedLayout && (
        <MenuItem
          label={_('Scrolled Mode')}
          shortcut='Shift+J'
          Icon={isScrolledMode ? MdCheck : undefined}
          onClick={toggleScrolledMode}
        />
      )}

      <MenuItem
        label={_('Auto Scroll')}
        shortcut='Shift+A'
        Icon={viewState?.autoScrollEnabled ? MdCheck : undefined}
        onClick={toggleAutoScroll}
        disabled={!isScrolledMode}
      />

      <hr aria-hidden='true' className='border-base-300 my-1' />

      {appService?.hasWindow && <MenuItem label={_('Fullscreen')} onClick={handleFullScreen} />}
      <MenuItem
        label={
          themeMode === 'dark'
            ? _('Dark Mode')
            : themeMode === 'light'
              ? _('Light Mode')
              : _('Auto Mode')
        }
        Icon={themeMode === 'dark' ? BiMoon : themeMode === 'light' ? BiSun : TbSunMoon}
        onClick={cycleThemeMode}
      />
      <MenuItem
        label={_('Invert Image In Dark Mode')}
        disabled={!isDarkMode}
        Icon={invertImgColorInDark ? MdCheck : undefined}
        onClick={() => setInvertImgColorInDark(!invertImgColorInDark)}
      />
    </Menu>
  );
};

export default ViewMenu;
