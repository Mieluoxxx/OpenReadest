import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { EnvProvider } from '@/context/EnvContext';
import BookshelfItem from '@/app/library/components/BookshelfItem';
import { Book, BooksGroup } from '@/types/book';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

// ---------- mocks ----------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => '' }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/services/environment', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(typeof actual === 'object' && actual !== null ? actual : {}),
    default: {
      ...(typeof actual === 'object' &&
      actual !== null &&
      'default' in actual &&
      typeof actual.default === 'object' &&
      actual.default !== null
        ? actual.default
        : {}),
      getAppService: vi.fn().mockResolvedValue({
        hasContextMenu: true,
        isAndroidApp: false,
        hasWindow: false,
      }),
    },
  };
});

vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: vi.fn(),
}));

vi.mock('@/utils/nav', () => ({
  navigateToLibrary: vi.fn(),
  navigateToReader: vi.fn(),
  showReaderWindow: vi.fn(),
}));

vi.mock('@/utils/misc', () => ({
  getOSPlatform: () => 'macos',
  stubTranslation: (key: string) => key,
  uniqueId: () => 'mock-id',
  randomMd5: () => 'mock-md5',
  getContentMd5: () => 'mock-md5',
}));

vi.mock('@/utils/os', () => ({
  FILE_REVEAL_LABELS: {
    macos: 'Reveal in Finder',
    windows: 'Reveal in File Explorer',
    linux: 'Reveal in Folder',
    default: 'Reveal in Folder',
  },
  FILE_REVEAL_PLATFORMS: 'macos',
}));

vi.mock('@/utils/event', () => ({
  eventDispatcher: { dispatch: vi.fn() },
}));

vi.mock('@/app/library/components/BookItem', () => ({
  default: () => <div data-testid='book-item-mock' />,
}));
vi.mock('@/app/library/components/GroupItem', () => ({
  default: () => <div data-testid='group-item-mock' />,
}));

vi.mock('@/store/libraryStore', () => ({
  useLibraryStore: () => ({ updateBook: vi.fn() }),
}));
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: () => ({
    settings: { localBooksDir: '/books', openBookInNewWindow: false },
  }),
}));

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const makeBook = (overrides: Partial<Book> = {}): Book =>
  ({
    hash: 'book1',
    title: 'Test Book',
    author: 'Author',
    format: 'EPUB',
    groupName: '',
    coverImageUrl: '',
    uploadedAt: null,
    downloadedAt: Date.now(),
    ...overrides,
  }) as Book;

const makeGroup = (overrides: Partial<BooksGroup> = {}): BooksGroup =>
  ({
    id: 'group1',
    name: 'Group One',
    displayName: 'Group One',
    books: [],
    updatedAt: Date.now(),
    ...overrides,
  }) as BooksGroup;

const renderItem = (props: Partial<React.ComponentProps<typeof BookshelfItem>> = {}) => {
  const base = {
    mode: 'grid' as const,
    item: makeBook(),
    coverFit: 'fit' as const,
    isSelectMode: false,
    itemSelected: false,
    transferProgress: null,
    setLoading: vi.fn(),
    toggleSelection: vi.fn(),
    handleGroupBooks: vi.fn(),
    handleBookDownload: vi.fn().mockResolvedValue(true),
    handleBookUpload: vi.fn().mockResolvedValue(true),
    handleBookDelete: vi.fn().mockResolvedValue(true),
    handleSetSelectMode: vi.fn(),
    handleShowDetailsBook: vi.fn(),
  };
  return render(
    <EnvProvider>
      <BookshelfItem {...base} {...props} />
    </EnvProvider>,
  );
};

// 模拟 hasContextMenu 桌面环境：等待 EnvProvider 解析 appService 后触发右键。
const openContextMenu = async (container: HTMLElement) => {
  const trigger = await waitFor(() => {
    const el = container.querySelector('[role="button"]') as HTMLElement;
    expect(el).not.toBeNull();
    return el;
  });
  // 给 appService 异步 setState + 重渲染留时间
  await new Promise((r) => setTimeout(r, 50));
  fireEvent.contextMenu(trigger);
  await waitFor(() => {
    expect(document.querySelector('.context-menu')).not.toBeNull();
  });
};

describe('BookshelfItem context menu (integration)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the daisyUI context menu on book right-click', async () => {
    const { container } = renderItem();
    await openContextMenu(container);
    expect(screen.getByText('Select Book')).toBeTruthy();
    expect(screen.getByText('Group Books')).toBeTruthy();
    expect(screen.getByText('Show Book Details')).toBeTruthy();
    expect(screen.getByText('Reveal in Finder')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('shows Download Book only for uploaded-not-downloaded books', async () => {
    const { container } = renderItem({
      item: makeBook({ uploadedAt: Date.now(), downloadedAt: null }),
    });
    await openContextMenu(container);
    expect(screen.getByText('Download Book')).toBeTruthy();
    expect(screen.queryByText('Upload Book')).toBeNull();
  });

  it('shows Upload Book only for downloaded-not-uploaded books', async () => {
    const { container } = renderItem({
      item: makeBook({ uploadedAt: null, downloadedAt: Date.now() }),
    });
    await openContextMenu(container);
    expect(screen.getByText('Upload Book')).toBeTruthy();
    expect(screen.queryByText('Download Book')).toBeNull();
  });

  it('opens group context menu with group items on group right-click', async () => {
    const { container } = renderItem({ item: makeGroup() });
    await openContextMenu(container);
    expect(screen.getByText('Select Group')).toBeTruthy();
    expect(screen.getByText('Group Books')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('closes the menu after clicking a menu item', async () => {
    const toggleSelection = vi.fn();
    const { container } = renderItem({ toggleSelection });
    await openContextMenu(container);
    fireEvent.click(screen.getByText('Select Book'));
    expect(toggleSelection).toHaveBeenCalledWith('book1');
    await waitFor(() => {
      expect(document.querySelector('.context-menu')).toBeNull();
    });
  });

  it('calls revealItemInDir with the book folder on reveal', async () => {
    const { container } = renderItem();
    await openContextMenu(container);
    fireEvent.click(screen.getByText('Reveal in Finder'));
    expect(revealItemInDir).toHaveBeenCalledWith('/books/book1');
    await waitFor(() => {
      expect(document.querySelector('.context-menu')).toBeNull();
    });
  });

  it('closes the menu on outside click (overlay)', async () => {
    const { container } = renderItem();
    await openContextMenu(container);
    const overlay = document.querySelector('.overlay') as HTMLElement;
    fireEvent.click(overlay);
    await waitFor(() => {
      expect(document.querySelector('.context-menu')).toBeNull();
    });
  });
});
