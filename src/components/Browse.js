import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Image,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SKINS, neobrutalist } from '../styles/theme';
import { getCachedBooks } from '../services/offline';
import * as api from '../services/api';

// High-quality mock data for showcase if the server is offline or empty
const MOCK_BOOKS = [
  {
    id: 'mock-1',
    itemId: 'mock-1',
    title: 'Moby Dick',
    author: 'Herman Melville',
    coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&q=80',
    progress: 0.35,
    description: 'The narrative of Ishmael and his voyage on the whaling ship Pequod, commanded by Captain Ahab.',
    chapters: [
      { id: '1', index: 1, title: 'Chapter 1: Loomings', duration: 420 },
      { id: '2', index: 2, title: 'Chapter 2: The Carpet-Bag', duration: 380 },
      { id: '3', index: 3, title: 'Chapter 3: The Spouter-Inn', duration: 960 },
    ],
    audioFiles: [
      { id: 'f1', metadata: { filename: 'moby_dick_ch1.mp3', size: 5000000 } },
      { id: 'f2', metadata: { filename: 'moby_dick_ch2.mp3', size: 4500000 } },
      { id: 'f3', metadata: { filename: 'moby_dick_ch3.mp3', size: 10000000 } },
    ]
  },
  {
    id: 'mock-2',
    itemId: 'mock-2',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    coverUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&q=80',
    progress: 0.85,
    description: 'A story of the mysterious millionaire Jay Gatsby and his obsession with the beautiful Daisy Buchanan.',
    chapters: [
      { id: '1', index: 1, title: 'Chapter I', duration: 600 },
      { id: '2', index: 2, title: 'Chapter II', duration: 750 },
    ],
    audioFiles: [
      { id: 'f4', metadata: { filename: 'gatsby_ch1.mp3', size: 7000000 } },
      { id: 'f5', metadata: { filename: 'gatsby_ch2.mp3', size: 8500000 } },
    ]
  },
  {
    id: 'mock-3',
    itemId: 'mock-3',
    title: '1984',
    author: 'George Orwell',
    coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=300&q=80',
    progress: 0.0,
    description: 'A dystopian social science fiction novel set in a world of perpetual war, omnipresent government surveillance, and historical negationism.',
    chapters: [
      { id: '1', index: 1, title: 'Chapter One', duration: 540 },
    ],
    audioFiles: [
      { id: 'f6', metadata: { filename: '1984_ch1.mp3', size: 6000000 } },
    ]
  },
  {
    id: 'mock-4',
    itemId: 'mock-4',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    coverUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=300&q=80',
    progress: 0.12,
    description: 'The story of Victor Frankenstein, a young scientist who creates a sapient creature in an unorthodox scientific experiment.',
    chapters: [
      { id: '1', index: 1, title: 'Letter 1', duration: 320 },
      { id: '2', index: 2, title: 'Letter 2', duration: 290 },
    ],
    audioFiles: [
      { id: 'f7', metadata: { filename: 'frankenstein_let1.mp3', size: 3000000 } },
      { id: 'f8', metadata: { filename: 'frankenstein_let2.mp3', size: 2800000 } },
    ]
  }
];

export default function Browse({ onSelectBook, onResumePlayback, theme = SKINS.Ledger }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [libraries, setLibraries] = useState([
    { id: 'all', name: 'All Server' },
    { id: 'cached', name: 'Cached Offline' },
  ]);
  const [selectedLibraryId, setSelectedLibraryId] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastActiveBook, setLastActiveBook] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadCatalog();
    loadLastActivePlayback();
  }, [selectedLibraryId]);

  // Load the list of books based on current filter selection
  const loadCatalog = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const session = await api.getCurrentSession();
      const serverUrl = session?.serverUrl;
      const token = session?.token;

      // Helper to augment items with local AsyncStorage progress values
      const setProcessedItems = async (itemsArray) => {
        try {
          const keys = itemsArray.map(item => `progress_${item.itemId || item.id}`);
          const pairs = await AsyncStorage.multiGet(keys);
          const progressMap = {};
          pairs.forEach(([k, v]) => {
            if (v) {
              try {
                const parsed = JSON.parse(v);
                progressMap[k.replace('progress_', '')] = parsed.progress;
              } catch(e) {}
            }
          });
          const finalItems = itemsArray.map(item => {
            const localP = progressMap[item.itemId || item.id];
            return {
              ...item,
              progress: localP !== undefined ? localP : item.progress,
            };
          });
          setItems(finalItems);
        } catch(e) {
          setItems(itemsArray);
        }
      };

      // Fetch cached/offline books first to merge or show
      const cachedBooks = await getCachedBooks();

      if (selectedLibraryId === 'cached') {
        // Show only downloaded books
        await setProcessedItems(cachedBooks);
      } else {
        // Attempt to fetch from server if credentials exist
        if (serverUrl && token) {
          try {
            // First fetch libraries if not done
            let activeLibId = selectedLibraryId;
            const libs = await api.getLibraries();
            
            if (libs && libs.length > 0) {
              // Update libraries tab listing
              setLibraries([
                { id: 'all', name: 'All Server' },
                ...libs.map(l => ({ id: l.id, name: l.name })),
                { id: 'cached', name: 'Cached Offline' },
              ]);
              if (activeLibId === 'all') {
                activeLibId = libs[0].id;
              }
            }

            if (activeLibId !== 'cached' && activeLibId !== 'all') {
              const itemData = await api.getLibraryItems(activeLibId);
              const serverItems = itemData.results || itemData.items || [];

              // Merge progress/cached state from offlineCatalog
              const mappedItems = serverItems.map(item => {
                const cached = cachedBooks.find(b => b.itemId === item.id);
                return {
                  id: item.id,
                  itemId: item.id,
                  title: item.media?.metadata?.title || item.title || 'Untitled',
                  author: item.media?.metadata?.authorName || item.author || 'Unknown',
                  coverUrl: cached ? cached.localCoverUrl : api.getCoverUrl(item.id),
                  progress: item.mediaProgress?.progress || item.userProgress?.progress || item.progress?.progress || item.progress || (cached ? cached.progress : 0),
                  description: item.media?.metadata?.description || '',
                  chapters: item.media?.chapters || [],
                  audioFiles: item.media?.audioFiles || [],
                  isCached: !!cached,
                };
              });
              await setProcessedItems(mappedItems);
            } else {
              // Fallback if no library IDs could be resolved
              await setProcessedItems(mergeCachedWithMock(cachedBooks));
            }
          } catch (fetchErr) {
            console.warn('[Browse] Server fetch failed, using fallback mock catalog:', fetchErr);
            setErrorMsg('OFFLINE: Server inaccessible. Loaded cached/mock items.');
            await setProcessedItems(mergeCachedWithMock(cachedBooks));
          }
        } else {
          // No server credentials -> Use Cached + Mock
          await setProcessedItems(mergeCachedWithMock(cachedBooks));
        }
      }
    } catch (err) {
      console.error('[Browse] Error loading catalog:', err);
      setErrorMsg('Error loading library content.');
    } finally {
      setLoading(false);
    }
  };

  const mergeCachedWithMock = (cachedBooks) => {
    // Combine unique cached books with the static mock list (preferring cached if matching ID)
    const cachedIds = cachedBooks.map(b => b.itemId);
    const uniqueMocks = MOCK_BOOKS.filter(mb => !cachedIds.includes(mb.itemId));
    return [...cachedBooks, ...uniqueMocks];
  };

  // Load last active playback details from AsyncStorage
  const loadLastActivePlayback = async () => {
    try {
      const activePlaybackStr = await AsyncStorage.getItem('lastActivePlayback');
      if (activePlaybackStr) {
        const playback = JSON.parse(activePlaybackStr);
        setLastActiveBook(playback);
      }
    } catch (e) {
      console.error('[Browse] Failed to load last active playback:', e);
    }
  };

  const handleSelectBook = (book) => {
    if (onSelectBook) {
      onSelectBook(book);
    }
  };

  const handleResumePlayback = () => {
    if (onResumePlayback && lastActiveBook) {
      onResumePlayback(lastActiveBook.itemId);
    }
  };

  // Filter items based on search query
  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    const titleMatch = item.title?.toLowerCase().includes(query);
    const authorMatch = item.author?.toLowerCase().includes(query);
    return titleMatch || authorMatch;
  });

  // Render individual audiobook card (2-column portrait grid)
  const renderBookCard = ({ item }) => {
    const progressPercent = Math.round((item.progress || 0) * 100);

    return (
      <TouchableOpacity
        style={styles.bookCard}
        onPress={() => handleSelectBook(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardShadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[
            styles.coverContainer,
            neobrutalist.border2(theme.contrast),
          ]}>
            <Image
              source={{ uri: item.coverUrl }}
              style={styles.coverImage}
            />
          </View>
        </View>

        {/* Progress Bar below Cover Art */}
        <View style={[styles.progressBarContainer, neobrutalist.border2(theme.contrast)]}>
          <View style={[
            styles.progressBarFill,
            {
              width: `${Math.min(100, Math.max(0, progressPercent))}%`,
              backgroundColor: theme.accent,
            }
          ]} />
        </View>

        <Text style={[styles.bookTitle, { color: theme.contrast }]} numberOfLines={1}>
          {item.title.toUpperCase()}
        </Text>
        <Text style={[styles.bookAuthor, { color: theme.muted }]} numberOfLines={1}>
          {item.author}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search Input with border */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchBar,
            neobrutalist.border2(theme.contrast),
          ]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="SEARCH CATALOGUE..."
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
        />
      </View>

      {/* Library Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <LibraryTabs
          libraries={libraries}
          selectedLibraryId={selectedLibraryId}
          onSelectLibrary={setSelectedLibraryId}
          theme={theme}
        />
      </View>

      {/* Offline Status Warning Indicator */}
      {errorMsg ? (
        <View style={[styles.errorBanner, neobrutalist.border2(theme.contrast)]}>
          <Text style={[styles.errorText, { color: theme.contrast }]}>{errorMsg.toUpperCase()}</Text>
        </View>
      ) : null}

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={theme.contrast} />
          <Text style={[styles.loadingText, { color: theme.contrast }]}>COMMUNING WITH ARCHIVE...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderBookCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            lastActiveBook ? (
              <View style={styles.bannerSpacing}>
                <View style={styles.bannerShadowContainer}>
                  <View style={neobrutalist.shadowBg(theme.contrast, 5)} />
                  <View style={[
                    styles.resumeBanner,
                    neobrutalist.border2(theme.contrast),
                  ]}>
                    <View style={styles.bannerHeader}>
                      <Text style={[styles.bannerLabel, { color: theme.contrast }]}>
                        [RESUME PLAYBACK]
                      </Text>
                      <Text style={[styles.bannerProgressLabel, { color: theme.muted }]}>
                        {Math.round((lastActiveBook.progress || 0) * 100)}% DONE
                      </Text>
                    </View>

                    <View style={styles.bannerBody}>
                      <Image
                        source={{ uri: lastActiveBook.coverUrl }}
                        style={[styles.bannerCover, neobrutalist.border2(theme.contrast)]}
                      />
                      <View style={styles.bannerInfo}>
                        <Text style={[styles.bannerTitle, { color: theme.contrast }]} numberOfLines={1}>
                          {lastActiveBook.title.toUpperCase()}
                        </Text>
                        <Text style={[styles.bannerAuthor, { color: theme.muted }]} numberOfLines={1}>
                          {lastActiveBook.author.toUpperCase()}
                        </Text>

                        {/* Banner Progress Bar */}
                        <View style={[styles.bannerProgressBorder, neobrutalist.border2(theme.contrast)]}>
                          <View style={[
                            styles.bannerProgressFill,
                            {
                              width: `${Math.round((lastActiveBook.progress || 0) * 100)}%`,
                              backgroundColor: theme.accent,
                            }
                          ]} />
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.resumeButton,
                        neobrutalist.border2(theme.contrast),
                        { backgroundColor: theme.accent },
                      ]}
                      onPress={handleResumePlayback}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.resumeButtonText, { color: theme.contrast }]}>
                        RESUME PLAYBACK
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={[styles.emptyContainer, neobrutalist.border2(theme.contrast)]}>
              <Text style={[styles.emptyText, { color: theme.contrast }]}>NO ARCHIVED DATA FOUND</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// Subcomponent: Library Tab Filter
function LibraryTabs({ libraries, selectedLibraryId, onSelectLibrary, theme }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsScroll}
      contentContainerStyle={styles.tabsContent}
    >
      {libraries.map((lib) => {
        const isSelected = lib.id === selectedLibraryId;
        return (
          <TouchableOpacity
            key={lib.id}
            style={[
              styles.tabButton,
              neobrutalist.border2(theme.contrast),
              { backgroundColor: isSelected ? theme.accent : '#FFFFFF' },
            ]}
            onPress={() => onSelectLibrary(lib.id)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.tabText,
              {
                color: theme.contrast,
                fontWeight: isSelected ? 'bold' : 'normal',
              }
            ]}>
              {lib.name.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchBar: {
    height: 48,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontFamily: 'Courier',
    fontSize: 14,
    color: '#000000',
  },
  tabsWrapper: {
    marginBottom: 16,
  },
  tabsScroll: {
    flexDirection: 'row',
  },
  tabsContent: {
    paddingRight: 16,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontFamily: 'Courier',
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: '#FFD2D2',
    padding: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  loadingText: {
    fontFamily: 'Courier',
    fontSize: 12,
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  bookCard: {
    width: '47%',
    marginBottom: 20,
  },
  cardShadowContainer: {
    position: 'relative',
    aspectRatio: 1,
    width: '100%',
    marginBottom: 8,
  },
  coverContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 8, // 8px rounded corners as specified
    backgroundColor: '#EAEAEA',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  bookTitle: {
    fontFamily: 'Anton',
    fontSize: 15,
    lineHeight: 18,
    marginBottom: 2,
  },
  bookAuthor: {
    fontFamily: 'Courier',
    fontSize: 11,
  },
  bannerSpacing: {
    marginBottom: 20,
  },
  bannerShadowContainer: {
    position: 'relative',
  },
  resumeBanner: {
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    paddingBottom: 6,
  },
  bannerLabel: {
    fontFamily: 'Anton',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  bannerProgressLabel: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bannerBody: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bannerCover: {
    width: 60,
    height: 60,
    backgroundColor: '#EAEAEA',
  },
  bannerInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontFamily: 'Anton',
    fontSize: 16,
    marginBottom: 2,
  },
  bannerAuthor: {
    fontFamily: 'Courier',
    fontSize: 12,
    marginBottom: 8,
  },
  bannerProgressBorder: {
    height: 6,
    backgroundColor: '#FFFFFF',
  },
  bannerProgressFill: {
    height: '100%',
  },
  resumeButton: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeButtonText: {
    fontFamily: 'Anton',
    fontSize: 13,
    letterSpacing: 1,
  },
  emptyContainer: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
