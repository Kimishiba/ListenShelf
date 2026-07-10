import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { neobrutalist } from '../styles/theme';
import { Play, Pause, ChevronUp, ChevronDown, Clock, Activity, Download } from 'lucide-react-native';
import * as audio from '../services/audio';
import * as api from '../services/api';
import * as offline from '../services/offline';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Player({ theme, activeBook }) {
  const [fullBook, setFullBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentPosition: 0,
    totalDuration: 0,
    activeFileIndex: 0,
    activeFileTitle: '',
    currentChapter: null,
    playbackSpeed: 1.0,
    isOffline: false,
  });

  const [showChapters, setShowChapters] = useState(false);
  const [sleepTimerActive, setSleepTimerActive] = useState(false);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState(0);
  const [sleepType, setSleepType] = useState('OFF'); // 'OFF', '15', '30', '45', '60', 'CH'
  
  const sleepTimerRef = useRef(null);
  const prevChapterRef = useRef(null);
  const [rulerWidth, setRulerWidth] = useState(0);

  // Load full book details and position when activeBook changes
  useEffect(() => {
    let active = true;

    async function loadBookData() {
      if (!activeBook) return;
      setLoading(true);
      const bookId = activeBook.itemId || activeBook.id;
      
      try {
        // 1. Initialize background audio settings
        await audio.initAudioMode();

        // 2. Check offline status
        const cached = await offline.isBookCached(bookId);
        setIsOffline(cached);

        let bookData = null;
        if (cached) {
          console.log('[Player] Book is cached locally. Loading local registry...');
          const cachedList = await offline.getCachedBooks();
          bookData = cachedList.find(b => b.itemId === bookId);
        }

        // Fallback to API if not cached or catalog read fails
        if (!bookData) {
          console.log('[Player] Loading book details from server api...');
          bookData = await api.getItemDetails(bookId);
        }

        if (!active) return;

        // Normalize book schema to support both local cached metadata and raw server API formats
        const normalizedBook = {
          id: bookData.itemId || bookData.id,
          itemId: bookData.itemId || bookData.id,
          title: bookData.title || bookData.media?.metadata?.title || 'UNTITLED',
          author: bookData.author || bookData.media?.metadata?.authorName || 'UNKNOWN',
          description: bookData.description || bookData.media?.metadata?.description || '',
          chapters: bookData.chapters || bookData.media?.chapters || [],
          audioFiles: bookData.audioFiles || bookData.media?.audioFiles || [],
          coverUrl: bookData.coverUrl || '',
        };

        setFullBook(normalizedBook);

        // 3. Resolve starting progress seconds
        let startPos = 0;
        
        // Check AsyncStorage cache first
        const cachedProgressStr = await AsyncStorage.getItem(`progress_${bookId}`);
        if (cachedProgressStr) {
          const cachedProgress = JSON.parse(cachedProgressStr);
          startPos = cachedProgress.currentTime || 0;
        }

        // If online, compare with latest server progress
        if (!cached) {
          try {
            const serverProgress = await api.getMediaProgress(bookId);
            if (serverProgress && serverProgress.currentTime !== undefined) {
              // Standard logic: pick server progress if newer or local is empty
              if (!cachedProgressStr || serverProgress.lastUpdate > JSON.parse(cachedProgressStr).lastUpdate) {
                startPos = serverProgress.currentTime;
              }
            }
          } catch (e) {
            console.warn('[Player] Failed to load progress from server:', e);
          }
        }

        // 4. Start audio playback
        audio.setStatusCallback((status) => {
          if (active) {
            setPlayerState(status);
            // Handle sleep timer End-of-Chapter trigger
            if (sleepTimerActive && sleepType === 'CH') {
              const currentCh = status.currentChapter;
              if (prevChapterRef.current && currentCh && prevChapterRef.current.title !== currentCh.title) {
                console.log('[SleepTimer] Chapter transition detected. Shutting down playback...');
                triggerSleepPause();
              }
              prevChapterRef.current = currentCh;
            }
          }
        });

        await audio.playBook(normalizedBook, startPos, cached);
      } catch (err) {
        console.error('[Player] Error loading book details:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBookData();

    return () => {
      active = false;
      audio.setStatusCallback(null);
    };
  }, [activeBook]);

  // Handle countdown sleep timer
  useEffect(() => {
    if (sleepTimerActive && sleepType !== 'CH' && sleepType !== 'OFF') {
      sleepTimerRef.current = setInterval(() => {
        setSleepSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(sleepTimerRef.current);
            setSleepTimerActive(false);
            setSleepType('OFF');
            triggerSleepPause();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
  }, [sleepTimerActive, sleepType]);

  const triggerSleepPause = async () => {
    if (playerState.isPlaying) {
      await audio.togglePlayPause();
    }
  };

  const handlePlayPause = async () => {
    await audio.togglePlayPause();
  };

  const handleSeekRelative = async (offsetSeconds) => {
    const target = playerState.currentPosition + offsetSeconds;
    await audio.seekToPosition(target);
  };

  const handleRulerPress = (event) => {
    if (rulerWidth === 0 || playerState.totalDuration === 0) return;
    const touchX = event.nativeEvent.locationX;
    const targetPercent = touchX / rulerWidth;
    const targetSeconds = targetPercent * playerState.totalDuration;
    audio.seekToPosition(targetSeconds);
  };

  const handleSetSpeed = async (speed) => {
    await audio.setPlaybackSpeed(speed);
  };

  const handleSelectSleepTimer = (minutes) => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
    }

    if (minutes === 'OFF') {
      setSleepTimerActive(false);
      setSleepType('OFF');
      setSleepSecondsLeft(0);
    } else if (minutes === 'CH') {
      setSleepTimerActive(true);
      setSleepType('CH');
      setSleepSecondsLeft(0);
      prevChapterRef.current = playerState.currentChapter;
    } else {
      const seconds = parseInt(minutes, 10) * 60;
      setSleepSecondsLeft(seconds);
      setSleepTimerActive(true);
      setSleepType(minutes);
    }
  };

  // Helper formatting seconds -> HH:MM:SS
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null) return '00:00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRemainingTime = (seconds, total) => {
    if (isNaN(seconds) || isNaN(total)) return '-00:00:00';
    const rem = Math.max(0, total - seconds);
    return `-${formatTime(rem)}`;
  };

  const formatSleepTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!activeBook) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContainer}>
          <View style={styles.shadowContainer}>
            <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
            <View style={[styles.emptyCard, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
              <Text style={[styles.emptyText, { color: theme.contrast }]}>[NO MEDIA MOUNTED]</Text>
              <Text style={[styles.emptySubtext, { color: theme.muted }]}>
                LOAD A VOLUME FROM THE BROWSE CABINET
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (loading || !fullBook) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.contrast} />
          <Text style={[styles.loadingText, { color: theme.contrast }]}>LOADING AUDIO TRACKS...</Text>
        </View>
      </View>
    );
  }

  const progressPercent = playerState.totalDuration > 0
    ? (playerState.currentPosition / playerState.totalDuration) * 100
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Top Header */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[styles.headerBox, neobrutalist.border4(theme.contrast), { backgroundColor: theme.accent }]}>
            <Text style={[styles.headerTitle, { color: theme.contrast }]}>VAULT PLAYER</Text>
            <Text style={[styles.headerSubtitle, { color: theme.contrast }]}>
              {isOffline ? '[STATUS: LOCAL OFFLINE PLAYBACK]' : '[STATUS: REMOTE LIVE STREAMING]'}
            </Text>
          </View>
        </View>

        {/* Audiobook Cover Frame */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 5)} />
          <View style={[styles.coverContainer, neobrutalist.border4(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
            <Image
              source={{ uri: isOffline ? offline.getLocalCoverUrl(fullBook.itemId || fullBook.id) : api.getCoverUrl(fullBook.itemId || fullBook.id) }}
              style={[styles.coverImage, neobrutalist.border2(theme.contrast)]}
              resizeMode="cover"
            />
            <Text style={[styles.bookTitle, { color: theme.contrast }]} numberOfLines={2}>
              {fullBook.title.toUpperCase()}
            </Text>
            <Text style={[styles.bookAuthor, { color: theme.muted }]} numberOfLines={1}>
              {fullBook.author.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Measuring Ruler Progress Bar */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[styles.rulerCard, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
            
            {/* Touchable Timeline ticks */}
            <View 
              style={[styles.rulerTimeline, neobrutalist.border2(theme.contrast)]}
              onLayout={(e) => setRulerWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onResponderRelease={handleRulerPress}
            >
              <View style={styles.ticksRow}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.tickMark, 
                      { 
                        backgroundColor: theme.contrast,
                        height: i % 5 === 0 ? 14 : 7,
                        width: i % 5 === 0 ? 2 : 1
                      }
                    ]} 
                  />
                ))}
              </View>
              {/* Slider cursor */}
              <View 
                style={[
                  styles.rulerCursor, 
                  { 
                    backgroundColor: theme.accent, 
                    borderColor: theme.contrast,
                    left: `${Math.max(0, Math.min(progressPercent, 98))}%` 
                  },
                  neobrutalist.border2(theme.contrast)
                ]} 
              />
            </View>

            {/* Timestamps */}
            <View style={styles.timeReadoutRow}>
              <Text style={[styles.timeText, { color: theme.contrast }]}>
                {formatTime(playerState.currentPosition)}
              </Text>
              <Text style={[styles.timeText, { color: theme.muted }]}>
                {formatRemainingTime(playerState.currentPosition, playerState.totalDuration)}
              </Text>
            </View>
          </View>
        </View>

        {/* Ledger Metadata Grid */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[styles.gridContainer, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
            
            {/* Row 1 */}
            <View style={[styles.gridRow, { borderBottomWidth: 2, borderBottomColor: theme.contrast }]}>
              <View style={[styles.gridCell, { borderRightWidth: 2, borderRightColor: theme.contrast }]}>
                <Text style={styles.cellLabel}>SPEED</Text>
                <Text style={[styles.cellValue, { color: theme.contrast }]}>{playerState.playbackSpeed.toFixed(2)}x</Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.cellLabel}>FILE TRACK</Text>
                <Text style={[styles.cellValue, { color: theme.contrast }]} numberOfLines={1}>
                  {(playerState.activeFileIndex + 1).toString().padStart(2, '0')}/{(fullBook.audioFiles?.length || 1).toString().padStart(2, '0')}
                </Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={styles.gridRow}>
              <View style={[styles.gridCell, { borderRightWidth: 2, borderRightColor: theme.contrast }]}>
                <Text style={styles.cellLabel}>ACTIVE CHAPTER</Text>
                <Text style={[styles.cellValue, { color: theme.contrast }]} numberOfLines={1}>
                  {playerState.currentChapter && playerState.currentChapter.title ? playerState.currentChapter.title.toUpperCase() : 'NO CHAPTER INDEX'}
                </Text>
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.cellLabel}>SLEEP TIMER</Text>
                <Text style={[styles.cellValue, { color: sleepTimerActive ? theme.accent : theme.muted }]}>
                  {sleepTimerActive 
                    ? (sleepType === 'CH' ? 'END_OF_CH' : formatSleepTime(sleepSecondsLeft))
                    : 'OFF'}
                </Text>
              </View>
            </View>

          </View>
        </View>

        {/* Playback Controls (Play / Pause / Multi-Step skips) */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[styles.controlsCard, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
            
            {/* Rewinds row */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.smallActionBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.background }]}
                onPress={() => handleSeekRelative(-10)}
              >
                <Text style={[styles.btnText, { color: theme.contrast }]}>-10S</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.smallActionBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.background }]}
                onPress={() => handleSeekRelative(-30)}
              >
                <Text style={[styles.btnText, { color: theme.contrast }]}>-30S</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.smallActionBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.background }]}
                onPress={() => handleSeekRelative(-60)}
              >
                <Text style={[styles.btnText, { color: theme.contrast }]}>-60S</Text>
              </TouchableOpacity>
            </View>

            {/* Play/Pause Central Button */}
            <TouchableOpacity 
              style={[styles.bigPlayBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.accent }]}
              onPress={handlePlayPause}
            >
              {playerState.isPlaying ? (
                <View style={styles.btnRow}>
                  <Pause size={22} color={theme.contrast} fill={theme.contrast} />
                  <Text style={[styles.playBtnText, { color: theme.contrast }]}>PAUSE SERVICE</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Play size={22} color={theme.contrast} fill={theme.contrast} />
                  <Text style={[styles.playBtnText, { color: theme.contrast }]}>ENGAGE PLAYBACK</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Fast Forwards row */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.smallActionBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.background }]}
                onPress={() => handleSeekRelative(10)}
              >
                <Text style={[styles.btnText, { color: theme.contrast }]}>+10S</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.smallActionBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.background }]}
                onPress={() => handleSeekRelative(30)}
              >
                <Text style={[styles.btnText, { color: theme.contrast }]}>+30S</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.smallActionBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.background }]}
                onPress={() => handleSeekRelative(60)}
              >
                <Text style={[styles.btnText, { color: theme.contrast }]}>+60S</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* Speed Modifier Panel */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[styles.panelCard, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.panelTitle, { color: theme.contrast }]}>PLAYBACK SPEED CONFIG</Text>
            <View style={styles.speedRow}>
              {[0.8, 0.9, 1.0, 1.1, 1.2].map((speed) => {
                const isActive = Math.abs(playerState.playbackSpeed - speed) < 0.05;
                return (
                  <TouchableOpacity
                    key={speed}
                    style={[
                      styles.speedBtn,
                      neobrutalist.border2(theme.contrast),
                      { backgroundColor: isActive ? theme.accent : theme.background }
                    ]}
                    onPress={() => handleSetSpeed(speed)}
                  >
                    <Text style={[styles.speedBtnText, { color: theme.contrast, fontWeight: isActive ? 'bold' : 'normal' }]}>
                      {speed.toFixed(2)}X
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Sleep Timer Selector */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[styles.panelCard, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
            <View style={styles.panelHeaderRow}>
              <Clock size={16} color={theme.contrast} />
              <Text style={[styles.panelTitle, { color: theme.contrast, marginLeft: 6 }]}>SLEEP TIMEOUT TRIGGER</Text>
            </View>
            <View style={styles.speedRow}>
              {['OFF', '15', '30', '45', 'CH'].map((type) => {
                const isActive = sleepType === type;
                let display = type;
                if (type === 'CH') display = 'END_CH';
                if (type !== 'OFF' && type !== 'CH') display = `${type}M`;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.speedBtn,
                      neobrutalist.border2(theme.contrast),
                      { backgroundColor: isActive ? theme.accent : theme.background }
                    ]}
                    onPress={() => handleSelectSleepTimer(type)}
                  >
                    <Text style={[styles.speedBtnText, { color: theme.contrast, fontWeight: isActive ? 'bold' : 'normal' }]}>
                      {display}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Expandable Chapters List Ledger */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <TouchableOpacity 
            style={[styles.chaptersHeaderBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.accent }]}
            onPress={() => setShowChapters(!showChapters)}
          >
            <Text style={[styles.chaptersHeaderTitle, { color: theme.contrast }]}>
              {showChapters ? 'COLLAPSE CHAPTER INDEX' : 'EXPAND CHAPTER INDEX'}
            </Text>
            {showChapters ? (
              <ChevronUp size={20} color={theme.contrast} />
            ) : (
              <ChevronDown size={20} color={theme.contrast} />
            )}
          </TouchableOpacity>
        </View>

        {showChapters && fullBook.chapters && (
          <View style={styles.shadowContainer}>
            <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
            <View style={[styles.chaptersLedgerTable, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
              <View style={[styles.tableHeader, { borderBottomWidth: 2, borderBottomColor: theme.contrast, backgroundColor: theme.background }]}>
                <Text style={[styles.tableHeaderCell, { width: '15%', borderRightWidth: 2, borderRightColor: theme.contrast }]}>ID</Text>
                <Text style={[styles.tableHeaderCell, { width: '60%', borderRightWidth: 2, borderRightColor: theme.contrast }]}>CHAPTER TITLE</Text>
                <Text style={[styles.tableHeaderCell, { width: '25%' }]}>START</Text>
              </View>
              {fullBook.chapters.map((ch, idx) => {
                const isActive = playerState.currentChapter && playerState.currentChapter.title === ch.title;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.tableRow,
                      { 
                        borderBottomWidth: idx === fullBook.chapters.length - 1 ? 0 : 2, 
                        borderBottomColor: theme.contrast,
                        backgroundColor: isActive ? theme.accent : '#FFFFFF'
                      }
                    ]}
                    onPress={() => audio.seekToPosition(parseFloat(ch.start))}
                  >
                    <Text style={[styles.tableCell, { width: '15%', borderRightWidth: 2, borderRightColor: theme.contrast, fontFamily: 'Courier' }]}>
                      {(idx + 1).toString().padStart(2, '0')}
                    </Text>
                    <Text style={[styles.tableCell, { width: '60%', borderRightWidth: 2, borderRightColor: theme.contrast, fontWeight: isActive ? 'bold' : 'normal' }]} numberOfLines={1}>
                      {(ch.title || '').toUpperCase()}
                    </Text>
                    <Text style={[styles.tableCell, { width: '25%', fontFamily: 'Courier' }]}>
                      {formatTime(ch.start)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  loadingText: {
    fontFamily: 'Courier',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 12,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'Anton',
    fontSize: 22,
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  scrollContainer: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  shadowContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  headerBox: {
    padding: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Anton',
    fontSize: 28,
  },
  headerSubtitle: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
  },
  coverContainer: {
    padding: 16,
    alignItems: 'center',
  },
  coverImage: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    backgroundColor: '#EAEAEA',
    marginBottom: 16,
  },
  bookTitle: {
    fontFamily: 'Anton',
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 6,
  },
  bookAuthor: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: 'bold',
  },
  rulerCard: {
    padding: 14,
  },
  rulerTimeline: {
    height: 32,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    alignItems: 'flex-end',
    height: '100%',
    paddingBottom: 4,
  },
  tickMark: {
    backgroundColor: '#000000',
  },
  rulerCursor: {
    position: 'absolute',
    width: 10,
    height: 24,
    top: 2,
  },
  timeReadoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gridContainer: {
    overflow: 'hidden',
  },
  gridRow: {
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  cellLabel: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 2,
  },
  cellValue: {
    fontFamily: 'Anton',
    fontSize: 14,
  },
  controlsCard: {
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  smallActionBtn: {
    width: '30%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bigPlayBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playBtnText: {
    fontFamily: 'Anton',
    fontSize: 18,
    marginLeft: 10,
  },
  panelCard: {
    padding: 14,
  },
  panelTitle: {
    fontFamily: 'Anton',
    fontSize: 14,
    marginBottom: 10,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  speedBtn: {
    flex: 1,
    marginHorizontal: 3,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedBtnText: {
    fontFamily: 'Courier',
    fontSize: 11,
  },
  chaptersHeaderBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  chaptersHeaderTitle: {
    fontFamily: 'Anton',
    fontSize: 16,
  },
  chaptersLedgerTable: {
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  tableHeaderCell: {
    fontFamily: 'Anton',
    fontSize: 11,
    paddingHorizontal: 8,
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  tableCell: {
    fontSize: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
});
