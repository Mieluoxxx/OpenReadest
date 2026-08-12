import clsx from 'clsx';
import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { navigateToLibrary, navigateToReader, showReaderWindow } from '@/utils/nav';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLongPress } from '@/hooks/useLongPress';
import ContextMenu from '@/components/ContextMenu';
import Menu from '@/components/Menu';
import MenuItem from '@/components/MenuItem';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { eventDispatcher } from '@/utils/event';
import { getOSPlatform } from '@/utils/misc';
import { throttle } from '@/utils/throttle';
import { LibraryCoverFitType, LibraryViewModeType } from '@/types/settings';
import { BOOK_UNGROUPED_ID, BOOK_UNGROUPED_NAME } from '@/services/constants';
import { FILE_REVEAL_LABELS, FILE_REVEAL_PLATFORMS } from '@/utils/os';
import { Book, BooksGroup } from '@/types/book';
import { md5Fingerprint } from '@/utils/md5';
import BookItem from './BookItem';
import GroupItem from './GroupItem';

export const generateBookshelfItems = (
  books: Book[],
  parentGroupName: string,
): (Book | BooksGroup)[] => {
  const groups: BooksGroup[] = books.reduce((acc: BooksGroup[], book: Book) => {
    if (book.deletedAt) return acc;
    if (parentGroupName && (!book.groupName || !book.groupName.startsWith(parentGroupName)))
      return acc;
    book.groupId = book.groupId || BOOK_UNGROUPED_ID;
    book.groupName = book.groupName || BOOK_UNGROUPED_NAME;
    const slashIndex = book.groupName.indexOf('/', parentGroupName.length + 1);
    const leafGroupName = book.groupName.substring(
      parentGroupName ? parentGroupName.length + 1 : 0,
      slashIndex > 0 ? slashIndex : undefined,
    );
    const fullGroupName = parentGroupName
      ? `${parentGroupName}${leafGroupName ? `/${leafGroupName}` : ''}`
      : leafGroupName;
    const groupIndex = acc.findIndex(
      (group) =>
        group.name === fullGroupName ||
        (parentGroupName && group.name === parentGroupName) ||
        (leafGroupName === BOOK_UNGROUPED_NAME && group.name === BOOK_UNGROUPED_NAME),
    );
    const booksGroup = acc[groupIndex];
    if (booksGroup) {
      booksGroup.books.push(book);
      booksGroup.updatedAt = Math.max(booksGroup.updatedAt, book.updatedAt);
    } else {
      const groupName = fullGroupName;
      acc.push({
        id: groupName === parentGroupName ? BOOK_UNGROUPED_ID : md5Fingerprint(groupName),
        name: groupName === parentGroupName ? BOOK_UNGROUPED_NAME : groupName,
        displayName: leafGroupName,
        books: [book],
        updatedAt: book.updatedAt,
      });
    }
    return acc;
  }, []);
  groups.forEach((group) => {
    group.books.sort((a, b) => b.updatedAt - a.updatedAt);
  });
  const ungroupedBooks: Book[] =
    groups.find((group) => group.name === BOOK_UNGROUPED_NAME || group.name === parentGroupName)
      ?.books || [];
  const groupedBooks: BooksGroup[] = groups.filter(
    (group) => group.name !== BOOK_UNGROUPED_NAME && group.name !== parentGroupName,
  );
  return [...ungroupedBooks, ...groupedBooks].sort((a, b) => b.updatedAt - a.updatedAt);
};

interface BookshelfItemProps {
  mode: LibraryViewModeType;
  item: Book | BooksGroup;
  coverFit: LibraryCoverFitType;
  isSelectMode: boolean;
  itemSelected: boolean;
  transferProgress: number | null;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSelection: (hash: string) => void;
  handleGroupBooks: () => void;
  handleBookDownload: (
    book: Book,
    options?: { redownload?: boolean; queued?: boolean },
  ) => Promise<boolean>;
  handleBookUpload: (book: Book, syncBooks?: boolean) => Promise<boolean>;
  handleBookDelete: (book: Book, syncBooks?: boolean) => Promise<boolean>;
  handleSetSelectMode: (selectMode: boolean) => void;
  handleShowDetailsBook: (book: Book) => void;
}

const BookshelfItem: React.FC<BookshelfItemProps> = ({
  mode,
  item,
  coverFit,
  isSelectMode,
  itemSelected,
  transferProgress,
  setLoading,
  toggleSelection,
  handleGroupBooks,
  handleBookUpload,
  handleBookDownload,
  handleSetSelectMode,
  handleShowDetailsBook,
}) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig, appService } = useEnv();
  const { settings } = useSettingsStore();
  const { updateBook } = useLibraryStore();

  const showBookDetailsModal = useCallback(async (book: Book) => {
    handleShowDetailsBook(book);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const makeBookAvailable = async (book: Book) => {
    if (book.uploadedAt && !book.downloadedAt) {
      if (await appService?.isBookAvailable(book)) {
        if (!book.downloadedAt || !book.coverDownloadedAt) {
          book.downloadedAt = Date.now();
          book.coverDownloadedAt = Date.now();
          await updateBook(envConfig, book);
        }
        return true;
      }
      let available = false;
      const loadingTimeout = setTimeout(() => setLoading(true), 200);
      try {
        available = await handleBookDownload(book, { queued: false });
        await updateBook(envConfig, book);
      } finally {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        setLoading(false);
        return available;
      }
    }
    return true;
  };

  const handleBookClick = useCallback(
    async (book: Book) => {
      if (isSelectMode) {
        toggleSelection(book.hash);
      } else {
        const available = await makeBookAvailable(book);
        if (!available) return;
        if (appService?.hasWindow && settings.openBookInNewWindow) {
          showReaderWindow(appService, [book.hash]);
        } else {
          setTimeout(() => {
            navigateToReader(router, [book.hash]);
          }, 0);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSelectMode, settings.openBookInNewWindow, appService],
  );

  const handleGroupClick = useCallback(
    (group: BooksGroup) => {
      if (isSelectMode) {
        toggleSelection(group.id);
      } else {
        const params = new URLSearchParams(searchParams?.toString());
        params.set('group', group.id);
        setTimeout(() => {
          navigateToLibrary(router, `${params.toString()}`);
        }, 0);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSelectMode, searchParams],
  );

  const [contextMenu, setContextMenu] = useState<{
    item: Book | BooksGroup;
    x: number;
    y: number;
  } | null>(null);

  // 门禁在调用点（useLongPress.onContextMenu / handleKeyDown）判断，避免 throttle 闭包捕获陈旧 appService
  const openContextMenu = (x: number, y: number) => {
    setContextMenu({ item, x, y });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSelectItem = useCallback(
    throttle(() => {
      if (!isSelectMode) {
        handleSetSelectMode(true);
      }
      if ('format' in item) {
        toggleSelection((item as Book).hash);
      } else {
        toggleSelection((item as BooksGroup).id);
      }
    }, 100),
    [isSelectMode],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleOpenItem = useCallback(
    throttle(() => {
      if (isSelectMode) {
        handleSelectItem();
        return;
      }
      if ('format' in item) {
        handleBookClick(item as Book);
      } else {
        handleGroupClick(item as BooksGroup);
      }
    }, 100),
    [handleSelectItem, handleBookClick, handleGroupClick],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleContextMenu = useCallback(
    throttle((e: React.MouseEvent) => {
      openContextMenu(e.clientX, e.clientY);
    }, 100),
    [item],
  );

  const { pressing, handlers } = useLongPress(
    {
      onLongPress: () => {
        handleSelectItem();
      },
      onTap: () => {
        handleOpenItem();
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (appService?.hasContextMenu) {
          handleContextMenu(e);
        } else if (appService?.isAndroidApp) {
          handleSelectItem();
        }
      },
    },
    [isSelectMode, handleSelectItem, handleOpenItem, handleContextMenu],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenItem();
    }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      if (!appService?.hasContextMenu) return;
      const rect = e.currentTarget.getBoundingClientRect();
      openContextMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  };

  return (
    <div className={clsx(mode === 'list' && 'sm:hover:bg-base-300/50 px-4 sm:px-6')}>
      <div
        className={clsx(
          'visible-focus-inset-2 group',
          mode === 'grid' &&
            'sm:hover:bg-base-300/50 flex h-full flex-col px-0 py-2 sm:px-4 sm:py-4',
          mode === 'list' && 'border-base-300 flex flex-col border-b py-2',
          appService?.isMobileApp && 'no-context-menu',
          pressing && mode === 'grid' ? 'not-eink:scale-95' : 'scale-100',
        )}
        role='button'
        tabIndex={0}
        aria-label={'format' in item ? item.title : item.name}
        style={{
          transition: 'transform 0.2s',
        }}
        onKeyDown={handleKeyDown}
        {...handlers}
      >
        <div className='flex h-full flex-col justify-end'>
          {'format' in item ? (
            <BookItem
              mode={mode}
              book={item}
              coverFit={coverFit}
              isSelectMode={isSelectMode}
              bookSelected={itemSelected}
              transferProgress={transferProgress}
              handleBookUpload={handleBookUpload}
              handleBookDownload={handleBookDownload}
              showBookDetailsModal={showBookDetailsModal}
            />
          ) : (
            <GroupItem
              mode={mode}
              group={item}
              isSelectMode={isSelectMode}
              groupSelected={itemSelected}
            />
          )}
        </div>
      </div>
      {contextMenu &&
        (() => {
          const menuItem = contextMenu.item;
          return (
            <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
              <Menu
                className='menu-content dropdown-content shadow-2xl'
                onCancel={() => setContextMenu(null)}
              >
                {'format' in menuItem ? (
                  <>
                    <MenuItem
                      noIcon
                      label={itemSelected ? _('Deselect Book') : _('Select Book')}
                      onClick={() => {
                        if (!isSelectMode) handleSetSelectMode(true);
                        toggleSelection(menuItem.hash);
                        setContextMenu(null);
                      }}
                    />
                    <MenuItem
                      noIcon
                      label={_('Group Books')}
                      onClick={() => {
                        if (!isSelectMode) handleSetSelectMode(true);
                        if (!itemSelected) {
                          toggleSelection(menuItem.hash);
                        }
                        handleGroupBooks();
                        setContextMenu(null);
                      }}
                    />
                    <MenuItem
                      noIcon
                      label={_('Show Book Details')}
                      onClick={() => {
                        showBookDetailsModal(menuItem);
                        setContextMenu(null);
                      }}
                    />
                    <MenuItem
                      noIcon
                      label={_(
                        FILE_REVEAL_LABELS[getOSPlatform() as FILE_REVEAL_PLATFORMS] ||
                          FILE_REVEAL_LABELS.default,
                      )}
                      onClick={() => {
                        revealItemInDir(`${settings.localBooksDir}/${menuItem.hash}`);
                        setContextMenu(null);
                      }}
                    />
                    {menuItem.uploadedAt && !menuItem.downloadedAt && (
                      <MenuItem
                        noIcon
                        label={_('Download Book')}
                        onClick={() => {
                          handleBookDownload(menuItem, { queued: true });
                          setContextMenu(null);
                        }}
                      />
                    )}
                    {!menuItem.uploadedAt && menuItem.downloadedAt && (
                      <MenuItem
                        noIcon
                        label={_('Upload Book')}
                        onClick={() => {
                          handleBookUpload(menuItem);
                          setContextMenu(null);
                        }}
                      />
                    )}
                    <MenuItem
                      noIcon
                      label={_('Delete')}
                      onClick={() => {
                        eventDispatcher.dispatch('delete-books', { ids: [menuItem.hash] });
                        setContextMenu(null);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <MenuItem
                      noIcon
                      label={itemSelected ? _('Deselect Group') : _('Select Group')}
                      onClick={() => {
                        if (!isSelectMode) handleSetSelectMode(true);
                        toggleSelection(menuItem.id);
                        setContextMenu(null);
                      }}
                    />
                    <MenuItem
                      noIcon
                      label={_('Group Books')}
                      onClick={() => {
                        if (!isSelectMode) handleSetSelectMode(true);
                        if (!itemSelected) {
                          toggleSelection(menuItem.id);
                        }
                        handleGroupBooks();
                        setContextMenu(null);
                      }}
                    />
                    <MenuItem
                      noIcon
                      label={_('Delete')}
                      onClick={() => {
                        eventDispatcher.dispatch('delete-books', { ids: [menuItem.id] });
                        setContextMenu(null);
                      }}
                    />
                  </>
                )}
              </Menu>
            </ContextMenu>
          );
        })()}
    </div>
  );
};

export default BookshelfItem;
