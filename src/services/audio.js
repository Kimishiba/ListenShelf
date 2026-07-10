import { Audio } from 'expo-av';
import * as offline from './offline';
import * as api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

let soundInstance = null;
let currentBook = null;
let currentFileIndex = -1;
let accumulatedTimeBeforeCurrentFile = 0; // Cumulative duration of files before the current one
let isPlaying = false;
let playbackSpeed = 1.0;
let isOfflineMode = false;
let onStatusChangeCallback = null;
let onStatusChangeCallbacks = [];
let globalPositionUpdateTimer = null;

// Configure native Android/iOS background audio capabilities
export async function initAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldRouteThroughEarpieceAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    console.log('[AudioService] Native background audio initialized successfully.');
  } catch (error) {
    console.error('[AudioService] Failed to set audio mode:', error);
  }
}

/**
 * Maps an absolute position in seconds (relative to the whole book) to a file index and offset.
 */
function getFileAndOffsetForPosition(positionSeconds, files) {
  let acc = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const duration = parseFloat(file.duration || 0);
    if (positionSeconds >= acc && positionSeconds < acc + duration) {
      return { fileIndex: i, fileOffset: positionSeconds - acc, accumulated: acc };
    }
    acc += duration;
  }
  // Fallback: if position exceeds total, return last file at its end
  if (files.length > 0) {
    const lastIdx = files.length - 1;
    const prevAcc = acc - parseFloat(files[lastIdx].duration || 0);
    return {
      fileIndex: lastIdx,
      fileOffset: parseFloat(files[lastIdx].duration || 0),
      accumulated: prevAcc
    };
  }
  return { fileIndex: 0, fileOffset: 0, accumulated: 0 };
}

/**
 * Triggers status updates to the UI callback
 */
function emitStatus(positionMillis = 0, durationMillis = 0) {
  const currentFilePos = positionMillis / 1000;
  const currentBookPosition = accumulatedTimeBeforeCurrentFile + currentFilePos;

  // Calculate total book duration
  let totalBookDuration = 0;
  if (currentBook && currentBook.audioFiles) {
    totalBookDuration = currentBook.audioFiles.reduce((acc, f) => acc + parseFloat(f.duration || 0), 0);
  }

  // Find active chapter
  let currentChapter = null;
  if (currentBook && currentBook.chapters) {
    currentChapter = currentBook.chapters.find(
      ch => currentBookPosition >= parseFloat(ch.start) && currentBookPosition < parseFloat(ch.end)
    );
  }

  const payload = {
    isPlaying,
    currentPosition: currentBookPosition,
    totalDuration: totalBookDuration,
    activeFileIndex: currentFileIndex,
    activeFileTitle: currentBook?.audioFiles?.[currentFileIndex]?.metadata?.filename || 'Track',
    currentChapter,
    playbackSpeed,
    isOffline: isOfflineMode,
    bookId: currentBook?.itemId || currentBook?.id,
    bookTitle: currentBook?.title || 'Unknown Title',
    bookAuthor: currentBook?.author || 'Unknown Author',
  };

  if (onStatusChangeCallback) {
    onStatusChangeCallback(payload);
  }

  onStatusChangeCallbacks.forEach(cb => {
    try {
      cb(payload);
    } catch (e) {
      console.warn('[AudioService] Callback invocation failed:', e);
    }
  });
}

/**
 * Handles status updates from the native player
 */
function onPlaybackStatusUpdate(status) {
  if (!status.isLoaded) {
    if (status.error) {
      console.error(`[AudioService] Native playback error: ${status.error}`);
    }
    return;
  }

  isPlaying = status.isPlaying;

  // Emit status change
  emitStatus(status.positionMillis, status.durationMillis);

  // Auto play next file when current track finishes
  if (status.didJustFinish) {
    console.log('[AudioService] Current file finished. Transitioning...');
    playNextFile();
  }
}

/**
 * Unloads the current sound instance
 */
async function unloadCurrentSound() {
  if (soundInstance) {
    try {
      // Remove progress status listener
      soundInstance.setOnPlaybackStatusUpdate(null);
      await soundInstance.unloadAsync();
    } catch (e) {
      console.warn('[AudioService] Failed to unload sound:', e);
    }
    soundInstance = null;
  }
}

/**
 * Loads and plays a specific file index at a given offset
 */
async function loadFileAtIndex(fileIndex, startOffsetSeconds, autoPlay = true) {
  if (!currentBook || !currentBook.audioFiles || fileIndex < 0 || fileIndex >= currentBook.audioFiles.length) {
    console.error('[AudioService] Cannot load file: invalid index', fileIndex);
    return;
  }

  await unloadCurrentSound();

  currentFileIndex = fileIndex;
  
  // Calculate accumulated time of previous files
  accumulatedTimeBeforeCurrentFile = 0;
  for (let i = 0; i < fileIndex; i++) {
    accumulatedTimeBeforeCurrentFile += parseFloat(currentBook.audioFiles[i].duration || 0);
  }

  const file = currentBook.audioFiles[fileIndex];
  
  // Resolve source URL/URI
  let sourceUri = '';
  if (isOfflineMode) {
    const filename = file.metadata?.filename || file.filename;
    sourceUri = offline.getLocalAudioUrl(currentBook.itemId || currentBook.id, filename);
    console.log(`[AudioService] Playing local file: ${sourceUri}`);
  } else {
    const fileId = file.ino || file.id;
    sourceUri = api.getAudioFileStreamUrl(currentBook.itemId || currentBook.id, fileId);
    console.log(`[AudioService] Streaming remote file: ${sourceUri}`);
  }

  try {
    const sound = new Audio.Sound();
    sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    
    await sound.loadAsync(
      { uri: sourceUri },
      {
        shouldPlay: autoPlay,
        positionMillis: Math.floor(startOffsetSeconds * 1000),
        rate: playbackSpeed,
        shouldCorrectPitch: true,
      }
    );

    soundInstance = sound;
    isPlaying = autoPlay;
    console.log(`[AudioService] Loaded file [${fileIndex + 1}/${currentBook.audioFiles.length}] successfully.`);
  } catch (error) {
    console.error('[AudioService] Failed to create sound instance:', error);
    // Emit failed state
    emitStatus(0, 0);
  }
}

/**
 * Advances playback to the next file in the sequence
 */
async function playNextFile() {
  if (!currentBook) return;
  const nextIndex = currentFileIndex + 1;
  if (nextIndex < currentBook.audioFiles.length) {
    console.log(`[AudioService] Loading next file [${nextIndex + 1}/${currentBook.audioFiles.length}]`);
    await loadFileAtIndex(nextIndex, 0, true);
  } else {
    console.log('[AudioService] Reached end of audiobook.');
    isPlaying = false;
    emitStatus();
    // Save completion progress to storage
    const bookId = currentBook.itemId || currentBook.id;
    const totalDuration = currentBook.audioFiles.reduce((acc, f) => acc + parseFloat(f.duration || 0), 0);
    const progressData = {
      currentTime: totalDuration,
      duration: totalDuration,
      progress: 1.0,
      isFinished: true,
      lastUpdate: Date.now()
    };
    await AsyncStorage.setItem(`progress_${bookId}`, JSON.stringify(progressData));
    if (!isOfflineMode) {
      try {
        await api.updateMediaProgress(bookId, progressData);
      } catch (err) {
        console.warn('[AudioService] Failed to sync finished progress to server:', err);
      }
    }
  }
}

/**
 * Starts or resumes playback for an audiobook
 */
export async function playBook(book, startPositionSeconds = 0, isOffline = false) {
  currentBook = book;
  isOfflineMode = isOffline;
  
  // Sort files by name/index if needed, but ABS usually delivers them sorted
  // Calculate relative index and offset
  const { fileIndex, fileOffset } = getFileAndOffsetForPosition(startPositionSeconds, book.audioFiles);
  console.log(`[AudioService] Mounting book: ${book.title}. Seeking to absolute: ${startPositionSeconds}s (File index: ${fileIndex}, Offset: ${fileOffset}s)`);

  await loadFileAtIndex(fileIndex, fileOffset, true);
  startProgressTrackingLoop();
}

/**
 * Toggles Play/Pause
 */
export async function togglePlayPause() {
  if (!soundInstance) return;
  try {
    if (isPlaying) {
      await soundInstance.pauseAsync();
      isPlaying = false;
      console.log('[AudioService] Playback paused.');
    } else {
      await soundInstance.playAsync();
      isPlaying = true;
      console.log('[AudioService] Playback resumed.');
    }
  } catch (error) {
    console.error('[AudioService] Toggle play/pause failed:', error);
  }
}

/**
 * Seeks to an absolute book position in seconds
 */
export async function seekToPosition(absoluteSeconds) {
  if (!currentBook) return;
  
  const totalDuration = currentBook.audioFiles.reduce((acc, f) => acc + parseFloat(f.duration || 0), 0);
  let targetSeconds = Math.max(0, Math.min(absoluteSeconds, totalDuration - 0.5));

  const { fileIndex, fileOffset } = getFileAndOffsetForPosition(targetSeconds, currentBook.audioFiles);
  
  if (fileIndex === currentFileIndex && soundInstance) {
    // Just seek inside the active sound track
    console.log(`[AudioService] Seeking inside current track to: ${fileOffset}s`);
    try {
      await soundInstance.setPositionAsync(Math.floor(fileOffset * 1000));
    } catch (e) {
      console.error('[AudioService] Seek failed:', e);
    }
  } else {
    // Unload current, load target file index and seek
    console.log(`[AudioService] Track shift required: moving to file index ${fileIndex} offset ${fileOffset}s`);
    await loadFileAtIndex(fileIndex, fileOffset, isPlaying);
  }
}

/**
 * Adjusts playback speed rate
 */
export async function setPlaybackSpeed(speed) {
  playbackSpeed = speed;
  if (soundInstance) {
    try {
      await soundInstance.setRateAsync(speed, true);
      console.log(`[AudioService] Speed adjusted to: ${speed}x`);
    } catch (e) {
      console.error('[AudioService] Speed adjust failed:', e);
    }
  }
}

/**
 * Registers status updates callback
 */
export function setStatusCallback(callback) {
  onStatusChangeCallback = callback;
}

export function registerStatusCallback(callback) {
  if (callback && !onStatusChangeCallbacks.includes(callback)) {
    onStatusChangeCallbacks.push(callback);
  }
}

export function unregisterStatusCallback(callback) {
  onStatusChangeCallbacks = onStatusChangeCallbacks.filter(cb => cb !== callback);
}

/**
 * Shuts down the player and cleans resources
 */
export async function destroyPlayer() {
  stopProgressTrackingLoop();
  await unloadCurrentSound();
  currentBook = null;
  currentFileIndex = -1;
  isPlaying = false;
  onStatusChangeCallback = null;
}

// Simple loop to save and sync progress to server every 10 seconds of active playback
function startProgressTrackingLoop() {
  stopProgressTrackingLoop();
  globalPositionUpdateTimer = setInterval(async () => {
    if (!isPlaying || !soundInstance || !currentBook) return;

    try {
      const status = await soundInstance.getStatusAsync();
      if (status.isLoaded) {
        const currentPos = accumulatedTimeBeforeCurrentFile + (status.positionMillis / 1000);
        const totalDuration = currentBook.audioFiles.reduce((acc, f) => acc + parseFloat(f.duration || 0), 0);
        const bookId = currentBook.itemId || currentBook.id;

        const progressData = {
          currentTime: currentPos,
          duration: totalDuration,
          progress: currentPos / totalDuration,
          isFinished: false,
          lastUpdate: Date.now()
        };

        // Cache locally immediately
        await AsyncStorage.setItem(`progress_${bookId}`, JSON.stringify(progressData));
        await AsyncStorage.setItem('lastPlayedBookId', bookId);

        // Sync with ABS server if online
        if (!isOfflineMode) {
          api.updateMediaProgress(bookId, progressData).catch(err => {
            console.warn('[AudioService] Failed to sync progress to server in background:', err);
          });
        }
      }
    } catch (e) {
      console.warn('[AudioService] Background progress tracking failed:', e);
    }
  }, 10000); // Sync progress every 10 seconds
}

function stopProgressTrackingLoop() {
  if (globalPositionUpdateTimer) {
    clearInterval(globalPositionUpdateTimer);
    globalPositionUpdateTimer = null;
  }
}
