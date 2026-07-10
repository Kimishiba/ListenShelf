import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SKINS, neobrutalist } from '../styles/theme';
import { logout } from '../services/api';
import { LogOut, Monitor, Database, User } from 'lucide-react-native';

export default function Settings({ theme, currentSkinName, onChangeSkin, session, onLogout }) {
  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        
        {/* Diagnostics Card */}
        <View style={styles.shadowContainer}>
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[
            styles.card,
            neobrutalist.border2(theme.contrast),
            { backgroundColor: '#FFFFFF' }
          ]}>
            <View style={styles.cardHeader}>
              <User size={18} color={theme.contrast} />
              <Text style={[styles.cardTitle, { color: theme.contrast }]}>
                SESSION DIAGNOSTICS
              </Text>
            </View>
            <View style={styles.separator} />
            <Text style={[styles.diagText, { color: theme.contrast }]}>
              USER: <Text style={styles.diagVal}>{session?.user?.username?.toUpperCase() || 'UNKNOWN'}</Text>
            </Text>
            <Text style={[styles.diagText, { color: theme.contrast }]}>
              ROLE: <Text style={styles.diagVal}>{(session?.user?.type || 'USER').toUpperCase()}</Text>
            </Text>
            <Text style={[styles.diagText, { color: theme.contrast }]}>
              MOUNT: <Text style={styles.diagVal} numberOfLines={1}>{session?.serverUrl || 'UNKNOWN'}</Text>
            </Text>
            <Text style={[styles.diagText, { color: theme.contrast }]}>
              TOKEN: <Text style={styles.diagVal} numberOfLines={1}>{session?.token ? `${session.token.substring(0, 15)}...` : 'NONE'}</Text>
            </Text>
          </View>
        </View>

        {/* Skin Selection Panel */}
        <Text style={[styles.sectionHeader, { color: theme.contrast }]}>
          SYSTEM SKINS
        </Text>

        {Object.values(SKINS).map((skin) => {
          const isSelected = skin.name === currentSkinName;
          
          return (
            <TouchableOpacity
              key={skin.name}
              style={styles.shadowContainer}
              onPress={() => onChangeSkin(skin.name)}
              activeOpacity={0.9}
            >
              <View style={neobrutalist.shadowBg(theme.contrast, 3)} />
              <View style={[
                styles.skinCard,
                neobrutalist.border2(theme.contrast),
                { backgroundColor: skin.background }
              ]}>
                <View style={styles.skinCardHeader}>
                  <Text style={[styles.skinName, { color: skin.contrast }]}>
                    {skin.name.toUpperCase()}
                  </Text>
                  
                  {isSelected ? (
                    <View style={[
                      styles.selectedBadge,
                      neobrutalist.border2(skin.contrast),
                      { backgroundColor: skin.accent }
                    ]}>
                      <Text style={[styles.selectedBadgeText, { color: skin.contrast }]}>
                        [ACTIVE]
                      </Text>
                    </View>
                  ) : null}
                </View>
                
                <View style={styles.colorPaletteRow}>
                  <View style={[styles.colorChip, neobrutalist.border2(skin.contrast), { backgroundColor: skin.background }]} />
                  <View style={[styles.colorChip, neobrutalist.border2(skin.contrast), { backgroundColor: skin.contrast }]} />
                  <View style={[styles.colorChip, neobrutalist.border2(skin.contrast), { backgroundColor: skin.accent }]} />
                  <View style={[styles.colorChip, neobrutalist.border2(skin.contrast), { backgroundColor: skin.muted }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtnContainer}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={neobrutalist.shadowBg(theme.contrast, 4)} />
          <View style={[
            styles.logoutBtn,
            neobrutalist.border2(theme.contrast),
            { backgroundColor: '#FF6B6B' }
          ]}>
            <LogOut size={18} color="#FFFFFF" style={styles.logoutIcon} />
            <Text style={styles.logoutBtnText}>
              SHUTDOWN SESSION
            </Text>
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  shadowContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  card: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: 'Anton',
    fontSize: 16,
    marginLeft: 8,
  },
  separator: {
    height: 2,
    backgroundColor: '#000000',
    marginBottom: 12,
  },
  diagText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  diagVal: {
    fontFamily: 'Courier',
    fontWeight: 'normal',
  },
  sectionHeader: {
    fontFamily: 'Anton',
    fontSize: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  skinCard: {
    padding: 14,
  },
  skinCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  skinName: {
    fontFamily: 'Anton',
    fontSize: 16,
  },
  selectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  selectedBadgeText: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: 'bold',
  },
  colorPaletteRow: {
    flexDirection: 'row',
  },
  colorChip: {
    width: 24,
    height: 18,
    marginRight: 6,
  },
  logoutBtnContainer: {
    position: 'relative',
    height: 52,
    marginTop: 20,
  },
  logoutBtn: {
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutBtnText: {
    fontFamily: 'Anton',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
