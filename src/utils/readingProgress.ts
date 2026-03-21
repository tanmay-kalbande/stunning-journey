// src/utils/readingProgress.ts - ENHANCED VERSION
import { ReadingBookmark } from '../types/book';

const BOOKMARK_KEY = 'pustakam-reading-bookmarks';

export const readingProgressUtils = {
  // Save bookmark for a book
  saveBookmark(bookId: string, moduleIndex: number, scrollPosition: number): void {
    try {
      const bookmarks = this.getAllBookmarks();
      const totalModules = this.getBookModuleCount(bookId);
      const percentComplete = totalModules > 0 ? ((moduleIndex + 1) / totalModules) * 100 : 0;

      bookmarks[bookId] = {
        bookId,
        moduleIndex,
        scrollPosition,
        lastReadAt: new Date(),
        percentComplete: Math.round(percentComplete)
      };

      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
    } catch (error) {
      console.error('Failed to save bookmark:', error);
    }
  },

  // Get bookmark for a book
  getBookmark(bookId: string): ReadingBookmark | null {
    try {
      const bookmarks = this.getAllBookmarks();
      const bookmark = bookmarks[bookId];
      
      if (bookmark) {
        return {
          ...bookmark,
          lastReadAt: new Date(bookmark.lastReadAt)
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get bookmark:', error);
      return null;
    }
  },

  // Get all bookmarks
  getAllBookmarks(): Record<string, ReadingBookmark> {
    try {
      const stored = localStorage.getItem(BOOKMARK_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to get bookmarks:', error);
      return {};
    }
  },

  // Delete bookmark
  deleteBookmark(bookId: string): void {
    try {
      const bookmarks = this.getAllBookmarks();
      delete bookmarks[bookId];
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
    }
  },

  // ✅ NEW: Check if a book has a bookmark
  hasBookmark(bookId: string): boolean {
    const bookmark = this.getBookmark(bookId);
    return bookmark !== null;
  },

  // ✅ NEW: Update bookmark scroll position only (keep other data)
  updateScrollPosition(bookId: string, scrollPosition: number): void {
    try {
      const bookmarks = this.getAllBookmarks();
      const existingBookmark = bookmarks[bookId];
      
      if (existingBookmark) {
        existingBookmark.scrollPosition = scrollPosition;
        existingBookmark.lastReadAt = new Date();
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
      }
    } catch (error) {
      console.error('Failed to update scroll position:', error);
    }
  },

  // ✅ NEW: Get bookmark stats for a book
  getBookmarkStats(bookId: string): {
    hasBookmark: boolean;
    percentComplete: number;
    lastReadDate: Date | null;
    daysAgo: number;
  } {
    const bookmark = this.getBookmark(bookId);
    
    if (!bookmark) {
      return {
        hasBookmark: false,
        percentComplete: 0,
        lastReadDate: null,
        daysAgo: 0
      };
    }

    const now = new Date();
    const lastRead = new Date(bookmark.lastReadAt);
    const diffMs = now.getTime() - lastRead.getTime();
    const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return {
      hasBookmark: true,
      percentComplete: bookmark.percentComplete,
      lastReadDate: lastRead,
      daysAgo
    };
  },

  // Get book module count (helper)
  getBookModuleCount(bookId: string): number {
    try {
      const booksJson = localStorage.getItem('pustakam-books');
      if (!booksJson) return 0;
      
      const books = JSON.parse(booksJson);
      const book = books.find((b: any) => b.id === bookId);
      return book?.modules?.length || 0;
    } catch (error) {
      return 0;
    }
  },

  // Format last read time
  formatLastRead(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  },

  // ✅ NEW: Clear old bookmarks (older than X days)
  clearOldBookmarks(daysOld: number = 30): number {
    try {
      const bookmarks = this.getAllBookmarks();
      const now = new Date();
      let removedCount = 0;

      Object.keys(bookmarks).forEach(bookId => {
        const bookmark = bookmarks[bookId];
        const lastRead = new Date(bookmark.lastReadAt);
        const daysSinceRead = Math.floor((now.getTime() - lastRead.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceRead > daysOld) {
          delete bookmarks[bookId];
          removedCount++;
        }
      });

      if (removedCount > 0) {
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
      }

      return removedCount;
    } catch (error) {
      console.error('Failed to clear old bookmarks:', error);
      return 0;
    }
  },

  // ✅ NEW: Export bookmarks for backup
  exportBookmarks(): string {
    try {
      const bookmarks = this.getAllBookmarks();
      return JSON.stringify({
        bookmarks,
        exportDate: new Date().toISOString(),
        version: '1.0'
      }, null, 2);
    } catch (error) {
      console.error('Failed to export bookmarks:', error);
      return '{}';
    }
  },

  // ✅ NEW: Import bookmarks from backup
  importBookmarks(jsonData: string): { success: boolean; count: number; error?: string } {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.bookmarks || typeof data.bookmarks !== 'object') {
        return { success: false, count: 0, error: 'Invalid bookmark data format' };
      }

      const existingBookmarks = this.getAllBookmarks();
      const mergedBookmarks = { ...existingBookmarks, ...data.bookmarks };
      
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(mergedBookmarks));
      
      return { 
        success: true, 
        count: Object.keys(data.bookmarks).length 
      };
    } catch (error) {
      return { 
        success: false, 
        count: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
};
