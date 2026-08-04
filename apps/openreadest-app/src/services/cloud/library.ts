import { EXTS } from '@/libs/document';
import { Book, BookFormat } from '@/types/book';
import { CLOUD_BOOKS_DIR, getRemoteLibraryKey } from './paths';
import { RemoteStorageError } from './remote/errors';
import { RemoteListEntry, RemoteObjectStore } from './remote/types';

export interface RemoteBookSummary {
  hash: string;
  title: string;
  sourceTitle?: string;
  format?: BookFormat;
}

export interface RemoteLibraryResult {
  books: RemoteBookSummary[];
  prefixCount: number;
  libraryCount: number;
}

const parseLibrary = (data: Uint8Array): Book[] => {
  const parsed = JSON.parse(new TextDecoder().decode(data)) as unknown;
  return Array.isArray(parsed) ? (parsed as Book[]) : [];
};

export class CloudLibraryService {
  constructor(private readonly store: RemoteObjectStore) {}

  async listRemoteBooks(): Promise<RemoteLibraryResult> {
    let entries: RemoteListEntry[];
    try {
      entries = await this.store.listChildren(`${CLOUD_BOOKS_DIR}/`);
    } catch (error) {
      if (error instanceof RemoteStorageError && error.code === 'not_found') entries = [];
      else throw error;
    }
    const hashes = new Set(
      entries
        .filter((entry) => entry.kind === 'prefix')
        .map((entry) => entry.key.replace(/\/+$/, '').split('/').pop())
        .filter((hash): hash is string => !!hash),
    );

    let library: Book[] = [];
    try {
      library = parseLibrary(await this.store.read(getRemoteLibraryKey()));
    } catch (error) {
      if (!(error instanceof RemoteStorageError) || error.code !== 'not_found') {
        if (error instanceof SyntaxError) library = [];
        else throw error;
      }
    }

    const byHash = new Map(library.map((book) => [book.hash, book]));
    const books = Array.from(hashes, (hash) => {
      const metadata = byHash.get(hash);
      return {
        hash,
        title: metadata?.title || hash,
        sourceTitle: metadata?.sourceTitle,
        format: metadata?.format,
      };
    }).sort((left, right) => left.title.localeCompare(right.title, 'zh-Hans-CN'));

    return { books, prefixCount: hashes.size, libraryCount: library.length };
  }

  async upsertRemoteLibrary(books: Book[]): Promise<void> {
    let remote: Book[] = [];
    try {
      remote = parseLibrary(await this.store.read(getRemoteLibraryKey()));
    } catch (error) {
      if (!(error instanceof RemoteStorageError) || error.code !== 'not_found') {
        if (!(error instanceof SyntaxError)) throw error;
      }
    }

    const byHash = new Map(remote.map((book) => [book.hash, book]));
    for (const book of books) {
      const previous = byHash.get(book.hash);
      byHash.set(book.hash, {
        ...previous,
        hash: book.hash,
        format: book.format,
        title: book.title,
        sourceTitle: book.sourceTitle,
        author: book.author,
        createdAt: previous?.createdAt ?? book.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      } as Book);
    }

    await this.store.write(
      getRemoteLibraryKey(),
      new TextEncoder().encode(JSON.stringify(Array.from(byHash.values()))),
      { contentType: 'application/json; charset=utf-8' },
    );
  }

  async inferRemoteBookFile(hash: string) {
    const entries = await this.store.listChildren(`${CLOUD_BOOKS_DIR}/${hash}/`);
    const knownExtensions = new Set(Object.values(EXTS));
    const bookEntry = entries.find((entry) => {
      if (entry.kind !== 'object') return false;
      const extension = entry.key.split('.').pop()?.toLowerCase() || '';
      return knownExtensions.has(extension);
    });
    if (!bookEntry) return null;

    const filename = bookEntry.key.split('/').pop() || '';
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const format = Object.entries(EXTS).find(([, value]) => value === extension)?.[0] as
      | BookFormat
      | undefined;
    return {
      bookFile: filename,
      format,
      title: filename.replace(new RegExp(`\\.${extension}$`, 'i'), ''),
    };
  }
}
