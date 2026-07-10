import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SKINS, neobrutalist } from './src/styles/theme';

// Import services
import { getCurrentSession, setCurrentSession } from './src/services/api';
import * as audio from './src/services/audio';

// Import components
import Login from './src/components/Login';
import UserRegistry from './src/components/UserRegistry';
import Browse from './src/components/Browse';
import BookDetails from './src/components/BookDetails';
import Player from './src/components/Player';
import Settings from './src/components/Settings';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Anton': require('./assets/fonts/Anton-Regular.ttf'),
    'Courier': require('./assets/fonts/CourierPrime-Regular.ttf'),
  });

  const [currentSkinName, setCurrentSkinName] = useState('Ledger');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState(null);
  const [showRegistry, setShowRegistry] = useState(false);
  const [activeTab, setActiveTab] = useState('BROWSE');
  const [activeBook, setActiveBook] = useState(null);
  const [selectedBookForDetails, setSelectedBookForDetails] = useState(null);
  const [miniPlayerState, setMiniPlayerState] = useState({
    bookId: null,
    title: '',
    author: '',
    isPlaying: false,
  });
  const [appReady, setAppReady] = useState(false);

  // Initialize session and skin settings on mount
  useEffect(() => {
    async function initializeApp() {
      try {
        // 1. Load active skin
        const storedSkin = await AsyncStorage.getItem('activeSkin');
        if (storedSkin && SKINS[storedSkin]) {
          setCurrentSkinName(storedSkin);
        }

        // 2. Load session
        const activeSession = await getCurrentSession();
        if (activeSession) {
          setSession(activeSession);
          setIsAuthenticated(true);
          setCurrentSession(activeSession);
          
          // Also set the active book if we have it in last active playback
          const lastActivePlaybackStr = await AsyncStorage.getItem('lastActivePlayback');
          if (lastActivePlaybackStr) {
            const playbackInfo = JSON.parse(lastActivePlaybackStr);
            setActiveBook({
              id: playbackInfo.itemId,
              itemId: playbackInfo.itemId,
              title: playbackInfo.title,
              author: playbackInfo.author,
              coverUrl: playbackInfo.coverUrl,
              progress: playbackInfo.progress,
            });
          }
        }
      } catch (e) {
        console.error('Initialization error:', e);
      } finally {
        setAppReady(true);
      }
    }
    initializeApp();
  }, []);

  // Listen to global audio service status updates to sync the mini-player
  useEffect(() => {
    const handleAudioStatusUpdate = (status) => {
      setMiniPlayerState({
        bookId: status.bookId,
        title: status.bookTitle,
        author: status.bookAuthor,
        isPlaying: status.isPlaying,
      });
    };

    audio.registerStatusCallback(handleAudioStatusUpdate);
    return () => {
      audio.unregisterStatusCallback(handleAudioStatusUpdate);
    };
  }, []);

  const handleMiniPlayerPlayPause = async () => {
    await audio.togglePlayPause();
  };

  if ((!fontsLoaded && !fontError) || !appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>BOOTING ARCHIVE...</Text>
      </View>
    );
  }

  const theme = SKINS[currentSkinName] || SKINS.Ledger;

  const handleLoginSuccess = (newSession) => {
    setSession(newSession);
    setIsAuthenticated(true);
    setCurrentSession(newSession);
  };

  const handleLogout = () => {
    setSession(null);
    setIsAuthenticated(false);
    setCurrentSession(null);
  };

  const handleChangeSkin = async (skinName) => {
    if (SKINS[skinName]) {
      setCurrentSkinName(skinName);
      await AsyncStorage.setItem('activeSkin', skinName);
    }
  };

  const handleSelectBook = async (book) => {
    setSelectedBookForDetails(book);
  };

  const handleResumePlayback = async (itemId) => {
    if (activeBook && (activeBook.id === itemId || activeBook.itemId === itemId)) {
      setActiveTab('PLAYER');
      return;
    }
    
    const lastActivePlaybackStr = await AsyncStorage.getItem('lastActivePlayback');
    if (lastActivePlaybackStr) {
      const playbackInfo = JSON.parse(lastActivePlaybackStr);
      if (playbackInfo.itemId === itemId) {
        setActiveBook({
          id: playbackInfo.itemId,
          itemId: playbackInfo.itemId,
          title: playbackInfo.title,
          author: playbackInfo.author,
          coverUrl: playbackInfo.coverUrl,
          progress: playbackInfo.progress,
        });
        setActiveTab('PLAYER');
      }
    }
  };

  // Render content according to authentication state
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <StatusBar style={currentSkinName === 'Terminal' || currentSkinName === 'Blueprint' ? 'light' : 'dark'} />
        {showRegistry ? (
          <UserRegistry
            onLoginSuccess={handleLoginSuccess}
            onSwitchToLogin={() => setShowRegistry(false)}
          />
        ) : (
          <Login
            theme={theme}
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegistry={() => setShowRegistry(true)}
          />
        )}
      </SafeAreaView>
    );
  }

  // Render tab content
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'BROWSE':
        if (selectedBookForDetails) {
          return (
            <BookDetails
              theme={theme}
              book={selectedBookForDetails}
              onBack={() => setSelectedBookForDetails(null)}
              onPlay={async (bookToPlay) => {
                setActiveBook(bookToPlay);
                setActiveTab('PLAYER');
                setSelectedBookForDetails(null);
                
                // Save as last active playback
                const playbackInfo = {
                  itemId: bookToPlay.itemId || bookToPlay.id,
                  title: bookToPlay.title,
                  author: bookToPlay.author,
                  coverUrl: bookToPlay.coverUrl,
                  progress: bookToPlay.progress || 0,
                };
                await AsyncStorage.setItem('lastActivePlayback', JSON.stringify(playbackInfo));
              }}
            />
          );
        }
        return (
          <Browse
            theme={theme}
            onSelectBook={handleSelectBook}
            onResumePlayback={handleResumePlayback}
          />
        );
      case 'PLAYER':
        return (
          <Player
            theme={theme}
            activeBook={activeBook}
          />
        );
      case 'SETTINGS':
        return (
          <Settings
            theme={theme}
            currentSkinName={currentSkinName}
            onChangeSkin={handleChangeSkin}
            session={session}
            onLogout={handleLogout}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar style={currentSkinName === 'Terminal' || currentSkinName === 'Blueprint' ? 'light' : 'dark'} />
      
      {/* Active Tab Screen Content */}
      <View style={styles.contentContainer}>
        {renderActiveTabContent()}
      </View>
      
      {/* Global Mini Play/Pause Bar (sits above Bottom Tab Navigator) */}
      {miniPlayerState.bookId && (
        <View style={[
          styles.miniPlayerBar,
          neobrutalist.border2(theme.contrast),
          { backgroundColor: theme.accent, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 }
        ]}>
          <TouchableOpacity 
            style={styles.miniPlayerInfo} 
            onPress={() => setActiveTab('PLAYER')}
            activeOpacity={0.9}
          >
            <View style={[styles.miniPlayerIndicator, { backgroundColor: miniPlayerState.isPlaying ? theme.contrast : theme.background }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.miniPlayerTitle, { color: theme.contrast }]} numberOfLines={1}>
                {(miniPlayerState.title || '').toUpperCase()}
              </Text>
              <Text style={[styles.miniPlayerAuthor, { color: theme.contrast, opacity: 0.7 }]} numberOfLines={1}>
                {(miniPlayerState.author || '').toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.miniPlayerPlayBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.background }]}
            onPress={handleMiniPlayerPlayPause}
            activeOpacity={0.8}
          >
            <Text style={[styles.miniPlayerPlayBtnText, { color: theme.contrast }]}>
              {miniPlayerState.isPlaying ? '[PAUSE]' : '[PLAY]'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Custom Bottom Tab Navigator */}
      <View style={[
        styles.tabBar, 
        neobrutalist.border2(theme.contrast),
        { 
          backgroundColor: theme.background,
          borderBottomWidth: 0,
          borderLeftWidth: 0,
          borderRightWidth: 0,
        }
      ]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'BROWSE' && { backgroundColor: theme.accent },
            { borderRightWidth: 2, borderRightColor: theme.contrast }
          ]}
          onPress={() => {
            if (activeTab === 'BROWSE') {
              setSelectedBookForDetails(null);
            } else {
              setActiveTab('BROWSE');
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.tabText,
            { color: theme.contrast },
            activeTab === 'BROWSE' && styles.tabTextActive
          ]}>
            [BROWSE]
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'PLAYER' && { backgroundColor: theme.accent },
            { borderRightWidth: 2, borderRightColor: theme.contrast }
          ]}
          onPress={() => setActiveTab('PLAYER')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.tabText,
            { color: theme.contrast },
            activeTab === 'PLAYER' && styles.tabTextActive
          ]}>
            [PLAYER]
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'SETTINGS' && { backgroundColor: theme.accent }
          ]}
          onPress={() => setActiveTab('SETTINGS')}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.tabText,
            { color: theme.contrast },
            activeTab === 'SETTINGS' && styles.tabTextActive
          ]}>
            [SETTINGS]
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontFamily: 'Courier', 
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'stretch',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    fontFamily: 'Anton',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    fontWeight: 'bold',
  },
  miniPlayerBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  miniPlayerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  miniPlayerIndicator: {
    width: 10,
    height: 10,
    marginRight: 12,
  },
  miniPlayerTitle: {
    fontFamily: 'Anton',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  miniPlayerAuthor: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 1,
  },
  miniPlayerPlayBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPlayerPlayBtnText: {
    fontFamily: 'Anton',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
