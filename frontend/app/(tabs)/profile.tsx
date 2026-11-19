import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getBaseUrl, setBaseUrl } from '../../services/apiClient';
import { deleteAccount, exportUserData, fetchSubscription, SubscriptionInfo } from '../../services/subscriptionService';
import { PaywallModal } from '../../components/PaywallModal';
import { CirclesModal } from '../../components/CirclesModal';

export default function ProfileScreen() {
  const {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    triggerSync,
    syncState,
    lastSyncResult,
  } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  // Phase 4 States
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [showCirclesModal, setShowCirclesModal] = useState(false);
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    getBaseUrl().then(setServerUrlInput);
    if (isAuthenticated) {
      loadSubscription();
    }
  }, [isAuthenticated]);

  const loadSubscription = async () => {
    try {
      const data = await fetchSubscription();
      setSubInfo(data);
    } catch {
      setSubInfo({
        tier: 'free',
        isPro: false,
        entitlements: {
          maxHabits: 5,
          aiCoachChatUnlocked: false,
          voiceJournalingUnlocked: false,
          audioBriefingsUnlocked: false,
          unlimitedCloudSync: false,
          accountabilityCirclesUnlocked: false,
        },
      });
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter both email and password.');
      return;
    }
    setIsSubmitting(true);
    setServerMessage(null);
    try {
      if (isRegisterMode) {
        await register(email.trim(), password, displayName.trim() || undefined);
        Alert.alert('Welcome!', 'Your cloud account has been created and synced.');
      } else {
        await login(email.trim(), password);
        Alert.alert('Welcome Back!', 'Logged in successfully. Cloud data synchronized.');
      }
    } catch (err: any) {
      setServerMessage(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrlInput.trim()) return;
    await setBaseUrl(serverUrlInput.trim());
    Alert.alert('Server Updated', `API endpoint set to: ${serverUrlInput.trim()}`);
  };

  const handleManualSync = async () => {
    const res = await triggerSync();
    if (res.success) {
      Alert.alert(
        'Sync Complete',
        `Pushed ${res.pushedCount} changes, pulled ${res.pulledCount} updates.`,
      );
    } else {
      Alert.alert('Sync Notice', res.error || 'Failed to sync');
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportUserData();
      Alert.alert(
        'GDPR Personal Data Export',
        `Export generated successfully!\n\nEmail: ${data.userData?.email}\nHabits Tracked: ${data.userData?.habits?.length || 0}\nReflections: ${data.userData?.reflections?.length || 0}\n\nDisclaimer: ${data.disclaimer}`,
      );
    } catch (err: any) {
      Alert.alert('Export Notice', err.message || 'Could not export data');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account & All Data?',
      'This will permanently delete your account, synced habits, and personal reflections. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await logout();
              Alert.alert('Account Deleted', 'Your account and data have been removed.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete account');
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isAuthenticated && user ? (
        // Logged-in Cloud Account View
        <View>
          {/* User Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName}>{user.displayName || 'Metanoia Member'}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>

            {/* Subscription Tier Badge */}
            <View style={[styles.tierBadge, subInfo?.isPro ? styles.tierBadgePro : styles.tierBadgeFree]}>
              <Text style={[styles.tierBadgeText, subInfo?.isPro ? styles.tierTextPro : styles.tierTextFree]}>
                {subInfo?.isPro ? '⭐ METANOIA PRO' : 'FREE TIER (5 Habits)'}
              </Text>
            </View>
          </View>

          {/* Pro Membership Banner */}
          {!subInfo?.isPro && (
            <TouchableOpacity
              style={styles.proUpgradeBanner}
              onPress={() => setShowPaywallModal(true)}
              activeOpacity={0.85}
            >
              <View>
                <Text style={styles.proUpgradeTitle}>Upgrade to Metanoia Pro ⭐</Text>
                <Text style={styles.proUpgradeSubtitle}>Unlimited habits, live AI Coach, voice notes & circles</Text>
              </View>
              <Text style={styles.proUpgradeArrow}>→</Text>
            </TouchableOpacity>
          )}

          {/* Social Accountability Circles */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Accountability Circles</Text>
            <Text style={styles.cardSubtitle}>
              Share daily progress milestones with friends and send encouragement reactions without toxic comparison.
            </Text>
            <TouchableOpacity
              style={styles.circleButton}
              onPress={() => setShowCirclesModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.circleButtonText}>👥 Open Accountability Circles</Text>
            </TouchableOpacity>
          </View>

          {/* Sync Control Center */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cloud Synchronization</Text>
            <Text style={styles.cardSubtitle}>
              Offline changes are automatically pushed to your PostgreSQL cloud database when connected.
            </Text>

            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Sync Status:</Text>
              <Text style={[styles.syncStatusText, { color: syncState === 'synced' ? '#10b981' : '#f59e0b' }]}>
                {syncState.toUpperCase()}
              </Text>
            </View>

            {lastSyncResult?.timestamp && (
              <View style={styles.syncRow}>
                <Text style={styles.syncLabel}>Last Sync:</Text>
                <Text style={styles.syncValue}>
                  {new Date(lastSyncResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleManualSync}
              disabled={syncState === 'syncing'}
              activeOpacity={0.8}
            >
              {syncState === 'syncing' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.syncButtonText}>⟳ Force Sync Now</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Privacy & Data Management */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Privacy & GDPR Export</Text>
            <Text style={styles.cardSubtitle}>
              Export your full habits, completions, and reflections data at any time.
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleExportData}>
              <Text style={styles.secondaryButtonText}>📦 Export My Data (JSON)</Text>
            </TouchableOpacity>
          </View>

          {/* Server Config */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Backend Server URL</Text>
            <TextInput
              style={styles.input}
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveServerUrl}>
              <Text style={styles.secondaryButtonText}>Update Server Endpoint</Text>
            </TouchableOpacity>
          </View>

          {/* Account Actions */}
          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} activeOpacity={0.8}>
            <Text style={styles.deleteButtonText}>Delete Account & Data</Text>
          </TouchableOpacity>

          {/* Health Disclaimer */}
          <Text style={styles.footerDisclaimer}>
            Metanoia is a personal growth companion and habit coach. It does not provide medical, psychiatric, or psychological diagnoses.
          </Text>
        </View>
      ) : (
        // Guest / Sign In View
        <View>
          <View style={styles.guestHeader}>
            <Text style={styles.guestTitle}>Connect Cloud Sync</Text>
            <Text style={styles.guestSubtitle}>
              Create an account or sign in to seamlessly back up and sync your habits across devices.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabToggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isRegisterMode && styles.toggleBtnActive]}
                onPress={() => setIsRegisterMode(false)}
              >
                <Text style={[styles.toggleBtnText, !isRegisterMode && styles.toggleBtnTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isRegisterMode && styles.toggleBtnActive]}
                onPress={() => setIsRegisterMode(true)}
              >
                <Text style={[styles.toggleBtnText, isRegisterMode && styles.toggleBtnTextActive]}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {serverMessage && <Text style={styles.errorBanner}>{serverMessage}</Text>}

            {isRegisterMode && (
              <>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </>
            )}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="alex@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAuth}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isRegisterMode ? 'Create Cloud Account' : 'Sign In & Sync'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Backend Server URL</Text>
            <TextInput
              style={styles.input}
              value={serverUrlInput}
              onChangeText={setServerUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveServerUrl}>
              <Text style={styles.secondaryButtonText}>Update Server Endpoint</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Paywall & Circles Modals */}
      <PaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onUpgraded={loadSubscription}
      />
      <CirclesModal
        visible={showCirclesModal}
        onClose={() => setShowCirclesModal(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  guestHeader: {
    marginBottom: 20,
    marginTop: 8,
  },
  guestTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  guestSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 20,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  tierBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeFree: {
    backgroundColor: '#f1f5f9',
  },
  tierBadgePro: {
    backgroundColor: '#fef3c7',
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tierTextFree: {
    color: '#475569',
  },
  tierTextPro: {
    color: '#b45309',
  },
  proUpgradeBanner: {
    backgroundColor: '#4338ca',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proUpgradeTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  proUpgradeSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  proUpgradeArrow: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 16,
  },
  circleButton: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  circleButtonText: {
    color: '#4338ca',
    fontSize: 14,
    fontWeight: '700',
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 18,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#ffffff',
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  syncLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  syncStatusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  syncValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  deleteButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  footerDisclaimer: {
    marginTop: 20,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
});
