import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Returns local path to the audio file
 * @param {string} itemId 
 * @param {string} filename 
 * @returns {string} local file URI
 */
export function getLocalAudioUrl(itemId, filename) {
  return `${FileSystem.documentDirectory}audio/${itemId}/${filename}`;
}

/**
 * Returns local path to the cover image
 * @param {string} itemId 
 * @returns {string} local cover URI
 */
export function getLocalCoverUrl(itemId) {
  return `${FileSystem.documentDirectory}covers/${itemId}.jpg`;
}

/**
 * Checks if a book is fully cached locally
 * @param {string} itemId 
 * @returns {Promise<boolean>}
 */
export async function isBookCached(itemId) {
  try {
    const catalogStr = await AsyncStorage.getItem('offlineCatalog');
    if (!catalogStr) return false;
    const catalog = JSON.parse(catalogStr);
    return !!(catalog[itemId] && catalog[itemId].status === 'completed');
  } catch (error) {
    console.error('[Offline] Error checking cache status:', error);
    return false;
  }
}

/**
 * Retrieves the list of all fully cached books from catalog metadata
 * @returns {Promise<Array>}
 */
export async function getCachedBooks() {
  try {
    const catalogStr = await AsyncStorage.getItem('offlineCatalog');
    if (!catalogStr) return [];
    const catalog = JSON.parse(catalogStr);
    return Object.values(catalog).filter(book => book.status === 'completed');
  } catch (error) {
    console.error('[Offline] Error reading cached books list:', error);
    return [];
  }
}

/**
 * Deletes downloaded files for a book from local disk and updates offlineCatalog
 * @param {string} itemId 
 */
export async function deleteBookCache(itemId) {
  try {
    // 1. Delete cover image file
    const coverPath = getLocalCoverUrl(itemId);
    await FileSystem.deleteAsync(coverPath, { idempotent: true });

    // 2. Delete entire audio files directory
    const audioDir = `${FileSystem.documentDirectory}audio/${itemId}/`;
    await FileSystem.deleteAsync(audioDir, { idempotent: true });

    // 3. Update the AsyncStorage catalog
    const catalogStr = await AsyncStorage.getItem('offlineCatalog');
    if (catalogStr) {
      const catalog = JSON.parse(catalogStr);
      delete catalog[itemId];
      await AsyncStorage.setItem('offlineCatalog', JSON.stringify(catalog));
    }
    console.log(`[Offline] Successfully deleted cache for book: ${itemId}`);
  } catch (error) {
    console.error(`[Offline] Error deleting book cache for ${itemId}:`, error);
    throw error;
  }
}

/**
 * Downloads a book's cover and audio files sequentially, saving index metadata in AsyncStorage
 * @param {string} itemId 
 * @param {string} apiCoverUrl - URL path or complete URL of cover
 * @param {Array} audioFiles - Array of audio files with metadata.filename and optionally url or ino
 * @param {string} serverUrl - Server base URL
 * @param {string} token - User's authorization token
 * @param {Function|object} [onProgressOrBookDetails] - Progress callback function or book details object
 * @param {object} [optionalBookDetails] - Book details (title, author, description, chapters)
 */
export async function downloadBook(
  itemId,
  apiCoverUrl,
  audioFiles,
  serverUrl,
  token,
  onProgressOrBookDetails = null,
  optionalBookDetails = {}
) {
  let onProgress = typeof onProgressOrBookDetails === 'function' ? onProgressOrBookDetails : null;
  let bookDetails = typeof onProgressOrBookDetails === 'object' ? onProgressOrBookDetails : (optionalBookDetails || {});

  const coversDir = `${FileSystem.documentDirectory}covers/`;
  const audioDir = `${FileSystem.documentDirectory}audio/${itemId}/`;

  try {
    // 1. Ensure target directories exist
    await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true }).catch(() => {});
    await FileSystem.makeDirectoryAsync(audioDir, { intermediates: true }).catch(() => {});

    // Initialize/Update the catalog state to "downloading"
    let catalog = {};
    try {
      const catalogStr = await AsyncStorage.getItem('offlineCatalog');
      if (catalogStr) {
        catalog = JSON.parse(catalogStr);
      }
    } catch (e) {
      console.warn('[Offline] Failed to parse existing catalog, starting fresh.', e);
    }

    catalog[itemId] = {
      itemId,
      title: bookDetails.title || 'Unknown Title',
      author: bookDetails.author || 'Unknown Author',
      description: bookDetails.description || '',
      chapters: bookDetails.chapters || [],
      coverUrl: getLocalCoverUrl(itemId),
      localCoverUrl: getLocalCoverUrl(itemId),
      audioFiles: audioFiles.map(file => ({
        ...file,
        localPath: getLocalAudioUrl(itemId, file.metadata?.filename || file.filename),
      })),
      downloadedAt: Date.now(),
      status: 'downloading',
    };
    await AsyncStorage.setItem('offlineCatalog', JSON.stringify(catalog));

    // 2. Download the cover image
    const coverLocalUri = getLocalCoverUrl(itemId);
    if (apiCoverUrl) {
      let coverUrl = apiCoverUrl;
      if (!coverUrl.startsWith('http')) {
        coverUrl = `${serverUrl}${coverUrl}`;
      }
      if (token && !coverUrl.includes('token=')) {
        coverUrl += (coverUrl.includes('?') ? '&' : '?') + `token=${token}`;
      }

      console.log(`[Offline] Downloading cover from: ${coverUrl}`);
      try {
        const coverDownload = FileSystem.createDownloadResumable(
          coverUrl,
          coverLocalUri,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        await coverDownload.downloadAsync();
      } catch (coverErr) {
        console.error('[Offline] Cover download failed:', coverErr);
      }
    }

    // 3. Download audio files sequentially
    if (onProgress) {
      onProgress({ status: 'starting', currentFileIndex: 0, totalFiles: audioFiles.length, progress: 0 });
    }

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const filename = file.metadata?.filename || file.filename || `track_${i}.mp3`;
      const localFileUri = getLocalAudioUrl(itemId, filename);

      let fileUrl = file.url;
      if (!fileUrl) {
        const ino = file.ino || file.id;
        if (ino) {
          fileUrl = `${serverUrl}/api/items/${itemId}/download/${ino}`;
        } else {
          fileUrl = `${serverUrl}/api/items/${itemId}/download`;
        }
      }

      if (!fileUrl.startsWith('http')) {
        fileUrl = `${serverUrl}${fileUrl}`;
      }

      if (token && !fileUrl.includes('token=')) {
        fileUrl += (fileUrl.includes('?') ? '&' : '?') + `token=${token}`;
      }

      console.log(`[Offline] Downloading file [${i + 1}/${audioFiles.length}]: ${filename}`);

      const downloadResumable = FileSystem.createDownloadResumable(
        fileUrl,
        localFileUri,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
        (downloadProgress) => {
          if (onProgress) {
            const fraction = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            onProgress({
              status: 'downloading',
              currentFileIndex: i,
              totalFiles: audioFiles.length,
              filename,
              progress: isNaN(fraction) ? 0 : fraction,
            });
          }
        }
      );

      await downloadResumable.downloadAsync();
    }

    // 4. Update the catalog status to "completed"
    try {
      const catalogStr = await AsyncStorage.getItem('offlineCatalog');
      if (catalogStr) {
        catalog = JSON.parse(catalogStr);
      }
    } catch (e) {}

    if (catalog[itemId]) {
      catalog[itemId].status = 'completed';
      await AsyncStorage.setItem('offlineCatalog', JSON.stringify(catalog));
    }

    if (onProgress) {
      onProgress({ status: 'completed', currentFileIndex: audioFiles.length, totalFiles: audioFiles.length, progress: 1 });
    }

    console.log(`[Offline] Finished caching book: ${itemId}`);
    return true;
  } catch (error) {
    console.error(`[Offline] Failed to download book ${itemId}:`, error);
    // Attempt clean-up of state on failure
    try {
      const catalogStr = await AsyncStorage.getItem('offlineCatalog');
      if (catalogStr) {
        const catalog = JSON.parse(catalogStr);
        if (catalog[itemId] && catalog[itemId].status === 'downloading') {
          delete catalog[itemId];
          await AsyncStorage.setItem('offlineCatalog', JSON.stringify(catalog));
        }
      }
    } catch (cleanErr) {
      console.error('[Offline] Clean-up failed:', cleanErr);
    }
    if (onProgress) {
      onProgress({ status: 'failed', error });
    }
    throw error;
  }
}
