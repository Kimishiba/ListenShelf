import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SKINS, neobrutalist } from '../styles/theme';
import { downloadBook, isBookCached, deleteBookCache } from '../services/offline';

const formatDuration = (seconds) => {
  if (isNaN(seconds) || seconds === null) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function BookDetails({ book, onBack, onPlay, theme = SKINS.Ledger }) {
  const [isCached, setIsCached] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle', 'starting', 'downloading', 'completed', 'failed'
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadFileInfo, setDownloadFileInfo] = useState({ index: 0, total: 0, filename: '' });
  const [errorMsg, setErrorMsg] = useState('');

  const itemId = book.itemId || book.id;

  useEffect(() => {
    checkCacheState();
  }, [itemId]);

  const checkCacheState = async () => {
    const cached = await isBookCached(itemId);
    setIsCached(cached);
    if (cached) {
      setDownloadStatus('completed');
    } else {
      setDownloadStatus('idle');
    }
  };

  const handleDownload = async () => {
    setErrorMsg('');
    setDownloadStatus('starting');
    setDownloadProgress(0);

    try {
      const serverUrl = await AsyncStorage.getItem('serverUrl') || '';
      const token = await AsyncStorage.getItem('token') || '';

      await downloadBook(
        itemId,
        book.coverUrl,
        book.audioFiles || [],
        serverUrl,
        token,
        (progressData) => {
          if (progressData.status === 'starting') {
            setDownloadStatus('downloading');
            setDownloadProgress(0);
          } else if (progressData.status === 'downloading') {
            setDownloadStatus('downloading');
            setDownloadProgress(progressData.progress);
            setDownloadFileInfo({
              index: progressData.currentFileIndex,
              total: progressData.totalFiles,
              filename: progressData.filename,
            });
          } else if (progressData.status === 'completed') {
            setDownloadStatus('completed');
            setDownloadProgress(1);
            setIsCached(true);
          } else if (progressData.status === 'failed') {
            setDownloadStatus('failed');
            setErrorMsg('Cache failed. Server offline or storage error.');
          }
        },
        {
          title: book.title,
          author: book.author,
          description: book.description,
          chapters: book.chapters,
        }
      );
    } catch (err) {
      console.error('[BookDetails] Download failed:', err);
      setDownloadStatus('failed');
      setErrorMsg('Failed to cache book.');
    }
  };

  const handleDeleteCache = async () => {
    try {
      await deleteBookCache(itemId);
      setIsCached(false);
      setDownloadStatus('idle');
    } catch (err) {
      console.error('[BookDetails] Cache deletion failed:', err);
      setErrorMsg('Failed to clear cached files.');
    }
  };

  return (
    <SafeAreaScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Back Header Nav */}
      <TouchableOpacity
        style={[
          styles.backButton,
          neobrutalist.border2(theme.contrast),
          { backgroundColor: '#FFFFFF' }
        ]}
        onPress={onBack}
        activeOpacity={0.8}
      >
        <Text style={[styles.backButtonText, { color: theme.contrast }]}>
          [← BACK TO CATALOGUE]
        </Text>
      </TouchableOpacity>

      {/* Book Identification Segment */}
      <View style={styles.headerSegment}>
        <View style={styles.coverShadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 5)} />
          <View style={[styles.coverContainer, neobrutalist.border4(theme.contrast)]}>
            <Image source={{ uri: book.coverUrl }} style={styles.coverImage} />
          </View>
        </View>

        <View style={styles.titleInfo}>
          <Text style={[styles.bookTitle, { color: theme.contrast }]}>
            {book.title.toUpperCase()}
          </Text>
          <Text style={[styles.bookAuthor, { color: theme.muted }]}>
            BY: {book.author.toUpperCase()}
          </Text>
          
          <TouchableOpacity
            style={[
              styles.playButton,
              neobrutalist.border2(theme.contrast),
              { backgroundColor: theme.accent }
            ]}
            onPress={() => onPlay(book)}
            activeOpacity={0.8}
          >
            <Text style={[styles.playButtonText, { color: theme.contrast }]}>
              ▶ START PLAYBACK
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Management / Download Panel */}
      <View style={styles.downloadPanel}>
        {downloadStatus === 'idle' && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              neobrutalist.border2(theme.contrast),
              { backgroundColor: '#FFFFFF' }
            ]}
            onPress={handleDownload}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionButtonText, { color: theme.contrast }]}>
              [DOWNLOAD LOCAL]
            </Text>
          </TouchableOpacity>
        )}

        {downloadStatus === 'starting' && (
          <View style={[styles.progressBox, neobrutalist.border2(theme.contrast)]}>
            <ActivityIndicator size="small" color={theme.contrast} />
            <Text style={[styles.progressText, { color: theme.contrast }]}>
              INITIALIZING CACHE ENGINE...
            </Text>
          </View>
        )}

        {downloadStatus === 'downloading' && (
          <View style={[styles.progressBox, neobrutalist.border2(theme.contrast)]}>
            <View style={styles.progressTextRow}>
              <Text style={[styles.progressText, { color: theme.contrast }]}>
                DOWNLOADING FILE: {downloadFileInfo.index + 1} / {downloadFileInfo.total}
              </Text>
              <Text style={[styles.progressPercent, { color: theme.muted }]}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
            <Text style={[styles.progressFilename, { color: theme.muted }]} numberOfLines={1}>
              FILE: {downloadFileInfo.filename}
            </Text>
            <View style={[styles.progressTrackBorder, neobrutalist.border2(theme.contrast)]}>
              <View style={[
                styles.progressTrackFill,
                { width: `${downloadProgress * 100}%`, backgroundColor: theme.accent }
              ]} />
            </View>
          </View>
        )}

        {downloadStatus === 'completed' && (
          <View style={styles.cachedContainer}>
            <View style={[styles.cachedBanner, neobrutalist.border2(theme.contrast)]}>
              <Text style={[styles.cachedText, { color: theme.contrast }]}>
                ✓ OFFLINE RECORD SECURED
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.deleteCacheButton,
                neobrutalist.border2(theme.contrast),
                { backgroundColor: '#FFD2D2' }
              ]}
              onPress={handleDeleteCache}
              activeOpacity={0.8}
            >
              <Text style={[styles.deleteCacheText, { color: theme.contrast }]}>
                [PURGE LOCAL CACHE]
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {downloadStatus === 'failed' && (
          <View style={styles.cachedContainer}>
            <View style={[styles.failedBanner, neobrutalist.border2(theme.contrast)]}>
              <Text style={[styles.failedText, { color: theme.contrast }]}>
                ! CACHE FAILED: {errorMsg.toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.actionButton,
                neobrutalist.border2(theme.contrast),
                { backgroundColor: '#FFFFFF' }
              ]}
              onPress={handleDownload}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionButtonText, { color: theme.contrast }]}>
                [RETRY DOWNLOAD]
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Editorial Description block (Libre Caslon Serif style) */}
      <View style={styles.shadowContainer}>
        <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
        <View style={[styles.descriptionCard, neobrutalist.border2(theme.contrast)]}>
          <Text style={[styles.descriptionHeader, { color: theme.contrast }]}>
            ARCHIVAL SUMMARY:
          </Text>
          <Text style={[styles.descriptionText, { color: theme.contrast }]}>
            {book.description ? book.description.trim() : 'NO HISTORICAL RECORD IN THE VAULT.'}
          </Text>
        </View>
      </View>

      {/* Chapters Header */}
      <Text style={[styles.sectionHeader, { color: theme.contrast }]}>
        CHAPTER INDEX
      </Text>

      {/* Tabular Grid of Chapters (solid 2px borders, no rounded corners) */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={[styles.tableHeader, neobrutalist.border2(theme.contrast)]}>
          <View style={[styles.headerCellNo, { borderRightColor: theme.contrast }]}>
            <Text style={[styles.headerCellText, { color: theme.contrast }]}>CH_NO</Text>
          </View>
          <View style={[styles.headerCellTitle, { borderRightColor: theme.contrast }]}>
            <Text style={[styles.headerCellText, { color: theme.contrast }]}>TITLE</Text>
          </View>
          <View style={styles.headerCellDuration}>
            <Text style={[styles.headerCellText, { color: theme.contrast }]}>DURATION</Text>
          </View>
        </View>

        {/* Table Body */}
        {book.chapters && book.chapters.length > 0 ? (
          book.chapters.map((chapter, i) => (
            <View key={chapter.id || i} style={[styles.tableRow, { borderColor: theme.contrast }]}>
              <View style={[styles.cellNo, { borderRightColor: theme.contrast }]}>
                <Text style={styles.cellText}>{chapter.index || i + 1}</Text>
              </View>
              <View style={[styles.cellTitle, { borderRightColor: theme.contrast }]}>
                <Text style={styles.cellText} numberOfLines={1}>{(chapter.title || '').toUpperCase()}</Text>
              </View>
              <View style={styles.cellDuration}>
                <Text style={styles.cellText}>{formatDuration(chapter.duration)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyTableRow, { borderColor: theme.contrast }]}>
            <Text style={styles.emptyTableText}>SINGLE FILE / NO CHAPTER DATA RECORDED</Text>
          </View>
        )}
      </View>
    </SafeAreaScrollView>
  );
}

// Wrapper to combine safe scroll rendering
function SafeAreaScrollView({ children, style }) {
  return (
    <ScrollView style={style} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
    paddingBottom: 40,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerSegment: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  coverShadowContainer: {
    position: 'relative',
    width: 120,
    height: 180,
  },
  coverContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EAEAEA',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  titleInfo: {
    flex: 1,
    marginLeft: 20,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  bookTitle: {
    fontFamily: 'Anton',
    fontSize: 22,
    lineHeight: 26,
    marginBottom: 6,
  },
  bookAuthor: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  playButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    fontFamily: 'Anton',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  downloadPanel: {
    marginBottom: 24,
  },
  actionButton: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressPercent: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressFilename: {
    fontFamily: 'Courier',
    fontSize: 10,
    marginBottom: 8,
  },
  progressTrackBorder: {
    height: 10,
    backgroundColor: '#FFFFFF',
  },
  progressTrackFill: {
    height: '100%',
  },
  cachedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cachedBanner: {
    flex: 1,
    height: 42,
    backgroundColor: '#E2F0D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cachedText: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
  },
  deleteCacheButton: {
    width: 140,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCacheText: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
  },
  failedBanner: {
    flex: 1,
    height: 42,
    backgroundColor: '#FADBD8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  failedText: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
  },
  shadowContainer: {
    position: 'relative',
    marginBottom: 28,
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  descriptionHeader: {
    fontFamily: 'Anton',
    fontSize: 13,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontFamily: 'Georgia', // Editorial classic look (Libre Caslon style layout)
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    fontFamily: 'Anton',
    fontSize: 18,
    marginBottom: 12,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFD700', // yellow accent
    height: 36,
  },
  headerCellNo: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 2,
  },
  headerCellTitle: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 8,
    borderRightWidth: 2,
  },
  headerCellDuration: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCellText: {
    fontFamily: 'Anton',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    backgroundColor: '#FFFFFF',
    height: 38,
  },
  cellNo: {
    width: 58, // slightly offset to fit inside borders
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 2,
  },
  cellTitle: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 8,
    borderRightWidth: 2,
  },
  cellDuration: {
    width: 78,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontFamily: 'Courier',
    fontSize: 12,
  },
  emptyTableRow: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    height: 48,
    backgroundColor: '#FFFFFF',
  },
  emptyTableText: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
