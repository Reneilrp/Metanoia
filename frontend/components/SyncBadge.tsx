import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export const SyncBadge: React.FC = () => {
  const { isAuthenticated, syncState, triggerSync } = useAuth();

  if (!isAuthenticated) {
    return (
      <View style={[styles.badge, styles.guestBadge]}>
        <Text style={styles.guestText}>⚡ Offline Local Mode</Text>
      </View>
    );
  }

  const handlePress = async () => {
    if (syncState !== 'syncing') {
      await triggerSync();
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={[styles.badge, getBadgeStyle(syncState)]}>
      {syncState === 'syncing' && <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 6 }} />}
      <Text style={getTextStyle(syncState)}>
        {syncState === 'syncing' && 'Syncing...'}
        {syncState === 'synced' && '✓ Cloud Synced'}
        {syncState === 'offline' && '⚡ Offline (Queued)'}
        {syncState === 'error' && '⚠️ Sync Error (Tap to retry)'}
        {syncState === 'idle' && 'Cloud Connected'}
      </Text>
    </TouchableOpacity>
  );
};

function getBadgeStyle(state: string) {
  switch (state) {
    case 'synced':
      return styles.syncedBadge;
    case 'syncing':
      return styles.syncingBadge;
    case 'offline':
      return styles.offlineBadge;
    case 'error':
      return styles.errorBadge;
    default:
      return styles.idleBadge;
  }
}

function getTextStyle(state: string) {
  switch (state) {
    case 'synced':
      return styles.syncedText;
    case 'syncing':
      return styles.syncingText;
    case 'offline':
      return styles.offlineText;
    case 'error':
      return styles.errorText;
    default:
      return styles.idleText;
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  guestBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    borderWidth: 1,
  },
  guestText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  syncedBadge: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
  },
  syncedText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  syncingBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
  },
  syncingText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
  },
  offlineBadge: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
  },
  offlineText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBadge: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  idleBadge: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
  },
  idleText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
});
