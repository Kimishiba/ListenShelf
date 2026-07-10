import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { login } from '../services/api';
import { neobrutalist } from '../styles/theme';

export default function Login({ theme, onLoginSuccess, onSwitchToRegistry }) {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const shortcuts = [
    'http://192.168.1.36:13378',
    'https://audiobooks.homeassistantkrooswijkhof.duckdns.org',
  ];

  const handleLogin = async () => {
    if (!serverUrl || !username || !password) {
      setError('ALL FIELDS ARE REQUIRED');
      return;
    }
    setError('');
    setLoading(false);

    try {
      setLoading(true);
      const session = await login(serverUrl, username, password);
      onLoginSuccess(session);
    } catch (err) {
      setError(err.message || 'AUTHENTICATION FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Title Block */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 5)} />
          <View style={[
            styles.titleBox,
            neobrutalist.border4(theme.contrast),
            { backgroundColor: theme.accent }
          ]}>
            <Text style={[styles.title, { color: theme.contrast }]}>
              SYS LOGIN
            </Text>
            <Text style={[styles.subtitle, { color: theme.contrast }]}>
              [RESTRICTED ACCESS PORTAL]
            </Text>
          </View>
        </View>

        {/* Error message */}
        {error ? (
          <View style={styles.shadowContainer}>
            <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
            <View style={[
              styles.errorBox,
              neobrutalist.border2(theme.contrast),
              { backgroundColor: '#FF6B6B' }
            ]}>
              <Text style={styles.errorTitle}>[ERROR PROTOCOL]</Text>
              <Text style={styles.errorText}>{error.toUpperCase()}</Text>
            </View>
          </View>
        ) : null}

        {/* Login Form Card */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 6)} />
          <View style={[
            styles.card,
            neobrutalist.border4(theme.contrast),
            { backgroundColor: '#FFFFFF' }
          ]}>
            
            {/* Input: Server URL */}
            <Text style={[styles.label, { color: theme.contrast }]}>
              1. SERVER URL
            </Text>
            <TextInput
              style={[
                styles.input,
                neobrutalist.border2(theme.contrast),
                { color: theme.contrast }
              ]}
              placeholder="http://192.168.1.xxx:port"
              placeholderTextColor={theme.muted}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Shortcuts */}
            <View style={styles.shortcutContainer}>
              <Text style={[styles.shortcutHeader, { color: theme.muted }]}>
                [QUICK CONSOLE MOUNT]
              </Text>
              {shortcuts.map((url) => (
                <TouchableOpacity
                  key={url}
                  style={[
                    styles.shortcutBtn,
                    neobrutalist.border2(theme.contrast),
                    { backgroundColor: theme.background }
                  ]}
                  onPress={() => setServerUrl(url)}
                >
                  <Text style={[styles.shortcutText, { color: theme.contrast }]} numberOfLines={1}>
                    {url}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input: Username */}
            <Text style={[styles.label, { color: theme.contrast, marginTop: 15 }]}>
              2. USERNAME
            </Text>
            <TextInput
              style={[
                styles.input,
                neobrutalist.border2(theme.contrast),
                { color: theme.contrast }
              ]}
              placeholder="identity_code"
              placeholderTextColor={theme.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* Input: Password */}
            <Text style={[styles.label, { color: theme.contrast, marginTop: 15 }]}>
              3. SECRET KEY (PASSWORD)
            </Text>
            <TextInput
              style={[
                styles.input,
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

            {/* Submit button */}
            <TouchableOpacity
              style={styles.btnContainer}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
              <View style={[
                styles.submitBtn,
                neobrutalist.border2(theme.contrast),
                { backgroundColor: theme.accent }
              ]}>
                {loading ? (
                  <ActivityIndicator size="small" color={theme.contrast} />
                ) : (
                  <Text style={[styles.submitBtnText, { color: theme.contrast }]}>
                    [INITIATE SESSION]
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Switch to Registry Link */}
        <TouchableOpacity
          style={styles.switchLinkContainer}
          onPress={onSwitchToRegistry}
          activeOpacity={0.8}
        >
          <View style={neobrutalist.shadowBg(theme.contrast, 3)} />
          <View style={[
            styles.switchLinkBtn,
            neobrutalist.border2(theme.contrast),
            { backgroundColor: '#FFFFFF' }
          ]}>
            <Text style={[styles.switchLinkText, { color: theme.contrast }]}>
              [LOAD PROFILE PICKER REGISTER]
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  titleBox: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Anton',
    fontSize: 48,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 6,
    letterSpacing: 1,
  },
  errorBox: {
    padding: 12,
  },
  errorTitle: {
    fontFamily: 'Anton',
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  errorText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  card: {
    padding: 20,
  },
  label: {
    fontFamily: 'Anton',
    fontSize: 18,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    fontFamily: 'Courier',
    fontSize: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
  },
  shortcutContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  shortcutHeader: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  shortcutBtn: {
    padding: 8,
    marginBottom: 6,
  },
  shortcutText: {
    fontFamily: 'Courier',
    fontSize: 11,
  },
  btnContainer: {
    position: 'relative',
    marginTop: 24,
    height: 52,
  },
  submitBtn: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: 'Anton',
    fontSize: 18,
    letterSpacing: 1,
  },
  switchLinkContainer: {
    position: 'relative',
    height: 48,
    marginTop: 10,
  },
  switchLinkBtn: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchLinkText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
