import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUsers, login } from '../services/api';
import { neobrutalist, SKINS } from '../styles/theme';
import { User, Shield, Key, ArrowLeft } from 'lucide-react-native';

export default function UserRegistry({ onLoginSuccess, onSwitchToLogin }) {
  const theme = SKINS.Ledger; // Always render in Ledger theme as requested
  const [users, setUsers] = useState([]);
  const [savedSessions, setSavedSessions] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Password prompt state
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Load registry data on mount
  useEffect(() => {
    loadRegistryData();
  }, []);

  const loadRegistryData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Load saved sessions (for quick profile switching)
      const savedSessionsStr = await AsyncStorage.getItem('savedSessions');
      const parsedSessions = savedSessionsStr ? JSON.parse(savedSessionsStr) : {};
      setSavedSessions(parsedSessions);

      // 2. Try to load cached users
      const cachedUsersStr = await AsyncStorage.getItem('cachedUsers');
      let loadedUsers = cachedUsersStr ? JSON.parse(cachedUsersStr) : [];

      // 3. Try to fetch fresh list if there is a saved admin/root session
      const sessionStr = await AsyncStorage.getItem('userSession');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.token && session.serverUrl && 
           (session.user.type === 'admin' || session.user.type === 'root')) {
          try {
            const freshUsers = await getUsers(session.serverUrl, session.token);
            loadedUsers = freshUsers;
            await AsyncStorage.setItem('cachedUsers', JSON.stringify(freshUsers));
          } catch (fetchErr) {
            console.log('Could not fetch fresh users, using cached:', fetchErr);
          }
        }
      }

      setUsers(loadedUsers);
    } catch (err) {
      setError('FAILED TO LOAD REGISTRY');
    } finally {
      setLoading(false);
    }
  };

  const handleUserTap = async (user) => {
    const userSession = savedSessions[user.username];
    if (userSession && userSession.token && userSession.serverUrl) {
      // Direct login!
      setLoginLoading(true);
      try {
        await AsyncStorage.setItem('userSession', JSON.stringify(userSession));
        onLoginSuccess(userSession);
      } catch (err) {
        setLoginError('SAVED SESSION EXPIRED');
        setSelectedUser(user);
      } finally {
        setLoginLoading(false);
      }
    } else {
      setSelectedUser(user);
      setPassword('');
      setLoginError('');
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      setLoginError('PASSWORD REQUIRED');
      return;
    }
    setLoginError('');
    setLoginLoading(true);

    try {
      // Get the server URL from currentSession or stored session
      const sessionStr = await AsyncStorage.getItem('userSession');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const serverUrl = session?.serverUrl || 'http://192.168.1.36:13378'; // Default fallback

      const newSession = await login(serverUrl, selectedUser.username, password);
      
      // Update saved sessions
      const updatedSessions = {
        ...savedSessions,
        [selectedUser.username]: newSession,
      };
      await AsyncStorage.setItem('savedSessions', JSON.stringify(updatedSessions));
      setSavedSessions(updatedSessions);

      // Refresh users if admin
      if (newSession.user.type === 'admin' || newSession.user.type === 'root') {
        try {
          const freshUsers = await getUsers(newSession.serverUrl, newSession.token);
          setUsers(freshUsers);
          await AsyncStorage.setItem('cachedUsers', JSON.stringify(freshUsers));
        } catch (e) {
          console.log('Failed to refresh user list:', e);
        }
      }

      onLoginSuccess(newSession);
      setSelectedUser(null);
    } catch (err) {
      setLoginError(err.message || 'LOGIN FAILED');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Title Header */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[
            styles.headerBox,
            neobrutalist.border4(theme.contrast),
            { backgroundColor: theme.accent }
          ]}>
            <Text style={[styles.headerTitle, { color: theme.contrast }]}>
              LEDGER REGISTRY
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.contrast }]}>
              [SELECT ACTIVE USER PROFILE]
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.shadowContainer}>
            <View style={neobrutalist.shadowBg(theme.contrast, 3)} />
            <View style={[styles.errorBox, neobrutalist.border2(theme.contrast)]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        ) : null}

        {/* Selected User Password Overlay / Panel */}
        {selectedUser ? (
          <View style={styles.shadowContainer}>
            <View style={neobrutalist.shadowBg(theme.contrast, 5)} />
            <View style={[
              styles.passwordCard,
              neobrutalist.border4(theme.contrast),
              { backgroundColor: '#FFFFFF' }
            ]}>
              <Text style={[styles.passwordTitle, { color: theme.contrast }]}>
                MOUNT PROFILE: {selectedUser.username.toUpperCase()}
              </Text>
              {loginError ? (
                <Text style={styles.loginErrorText}>[ERR: {loginError.toUpperCase()}]</Text>
              ) : null}
              
              <Text style={[styles.passwordLabel, { color: theme.contrast }]}>
                ENTER ACCESS KEY:
              </Text>
              <TextInput
                style={[
                  styles.passwordInput,
                  neobrutalist.border2(theme.contrast),
                  { color: theme.contrast }
                ]}
                placeholder="••••••••••••"
                placeholderTextColor={theme.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.passwordBtnRow}>
                <TouchableOpacity
                  style={[styles.passwordBtn, neobrutalist.border2(theme.contrast), { backgroundColor: theme.accent }]}
                  onPress={handlePasswordSubmit}
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <ActivityIndicator size="small" color={theme.contrast} />
                  ) : (
                    <Text style={[styles.passwordBtnText, { color: theme.contrast }]}>[MOUNT]</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.passwordBtn, neobrutalist.border2(theme.contrast), { backgroundColor: '#FF6B6B' }]}
                  onPress={() => setSelectedUser(null)}
                  disabled={loginLoading}
                >
                  <Text style={[styles.passwordBtnText, { color: '#FFFFFF' }]}>[CANCEL]</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* Users Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.contrast} />
            <Text style={[styles.loadingText, { color: theme.contrast }]}>FETCHING USER SHEETS...</Text>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.shadowContainer}>
            <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
            <View style={[styles.emptyCard, neobrutalist.border2(theme.contrast), { backgroundColor: '#FFFFFF' }]}>
              <Text style={[styles.emptyText, { color: theme.contrast }]}>
                NO CACHED USER PROFILES DETECTED.
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.muted }]}>
                PLEASE INITIALIZE SERVER VIA MANUAL LOGIN FIRST.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {users.map((user) => {
              const hasSavedToken = !!savedSessions[user.username];
              const isAdmin = user.type === 'admin' || user.type === 'root';
              
              return (
                <TouchableOpacity
                  key={user.id}
                  style={styles.gridItemContainer}
                  onPress={() => handleUserTap(user)}
                  activeOpacity={0.8}
                >
                  <View style={neobrutalist.shadowBg(theme.contrast, 3)} />
                  <View style={[
                    styles.userCard,
                    neobrutalist.border2(theme.contrast),
                    { backgroundColor: hasSavedToken ? '#E6FFE6' : '#FFFFFF' }
                  ]}>
                    <View style={styles.userCardHeader}>
                      {isAdmin ? (
                        <Shield size={20} color={theme.contrast} />
                      ) : (
                        <User size={20} color={theme.contrast} />
                      )}
                      {hasSavedToken ? (
                        <Key size={14} color="#009900" style={styles.keyIcon} />
                      ) : null}
                    </View>
                    
                    <Text style={[styles.usernameText, { color: theme.contrast }]} numberOfLines={1}>
                      {user.username}
                    </Text>
                    
                    <Text style={[styles.userTypeText, { color: theme.muted }]}>
                      [{user.type.toUpperCase()}]
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Switch back to Login */}
        <TouchableOpacity
          style={styles.switchContainer}
          onPress={onSwitchToLogin}
          activeOpacity={0.8}
        >
          <View style={neobrutalist.shadowBg(theme.contrast, 3)} />
          <View style={[
            styles.switchBtn,
            neobrutalist.border2(theme.contrast),
            { backgroundColor: '#FFFFFF' }
          ]}>
            <View style={styles.switchBtnInner}>
              <ArrowLeft size={16} color={theme.contrast} />
              <Text style={[styles.switchBtnText, { color: theme.contrast }]}>
                [BACK TO MANUAL CONNECT]
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 60,
  },
  shadowContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  headerBox: {
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Anton',
    fontSize: 32,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  errorBox: {
    padding: 12,
    backgroundColor: '#FF6B6B',
  },
  errorText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  passwordCard: {
    padding: 20,
  },
  passwordTitle: {
    fontFamily: 'Anton',
    fontSize: 20,
    marginBottom: 10,
  },
  passwordLabel: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  passwordInput: {
    fontFamily: 'Courier',
    fontSize: 16,
    padding: 10,
    backgroundColor: '#F9F9F9',
    marginBottom: 15,
  },
  passwordBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  passwordBtn: {
    flex: 0.48,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordBtnText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loginErrorText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#FF0000',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Anton',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: 'Courier',
    fontSize: 11,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gridItemContainer: {
    width: '48%',
    marginBottom: 16,
    position: 'relative',
  },
  userCard: {
    padding: 16,
    height: 100,
    justifyContent: 'space-between',
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyIcon: {
    marginLeft: 'auto',
  },
  usernameText: {
    fontFamily: 'Anton',
    fontSize: 16,
    textTransform: 'uppercase',
  },
  userTypeText: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
  },
  switchContainer: {
    position: 'relative',
    height: 48,
    marginTop: 10,
  },
  switchBtn: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchBtnText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
