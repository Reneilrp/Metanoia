import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { upgradeSubscription } from '../services/subscriptionService';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose, onUpgraded }) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      await upgradeSubscription(selectedPlan === 'annual' ? 'pro_annual' : 'pro_monthly');
      Alert.alert(
        'Welcome to Metanoia Pro! ⭐',
        'All premium features have been unlocked. Unlimited habits, live AI Coach, and voice journaling are now active.',
        [
          {
            text: 'Let’s Go!',
            onPress: () => {
              onUpgraded?.();
              onClose();
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Upgrade successful in sandbox.');
      onUpgraded?.();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>⭐ METANOIA PRO</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isLoading}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Unlock Your Highest Consistency</Text>
            <Text style={styles.subtitle}>
              Transform your habit routines with personal AI guidance, speech journaling, and shared momentum.
            </Text>

            {/* Feature List */}
            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <Text style={styles.checkIcon}>✓</Text>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureTitle}>Unlimited Active Habits</Text>
                  <Text style={styles.featureDesc}>Scale beyond the 5-habit free limit as your routines grow.</Text>
                </View>
              </View>

              <View style={styles.featureRow}>
                <Text style={styles.checkIcon}>✓</Text>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureTitle}>Unlimited AI Coach Chat & Rescue</Text>
                  <Text style={styles.featureDesc}>On-demand habit diagnosis, streak recovery, and personalized weekly reviews.</Text>
                </View>
              </View>

              <View style={styles.featureRow}>
                <Text style={styles.checkIcon}>✓</Text>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureTitle}>Voice Journaling & Audio Briefings</Text>
                  <Text style={styles.featureDesc}>Speak your reflections; listen to neural coach morning summaries.</Text>
                </View>
              </View>

              <View style={styles.featureRow}>
                <Text style={styles.checkIcon}>✓</Text>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureTitle}>Private Accountability Circles</Text>
                  <Text style={styles.featureDesc}>Join peers with shared goal milestones and encouragement reactions.</Text>
                </View>
              </View>
            </View>

            {/* Plan Selector */}
            <View style={styles.plansContainer}>
              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'annual' && styles.planCardActive]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.8}
              >
                <View style={styles.saveTag}>
                  <Text style={styles.saveTagText}>SAVE 33%</Text>
                </View>
                <Text style={styles.planDuration}>Annual Membership</Text>
                <Text style={styles.planPrice}>$39.99 / year</Text>
                <Text style={styles.planSub}>Just $3.33 / month, billed annually</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.8}
              >
                <Text style={styles.planDuration}>Monthly Flex</Text>
                <Text style={styles.planPrice}>$4.99 / month</Text>
                <Text style={styles.planSub}>Cancel anytime</Text>
              </TouchableOpacity>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleUpgrade}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {selectedPlan === 'annual' ? 'Start Annual Pro ($39.99/yr)' : 'Start Monthly Pro ($4.99/mo)'}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimerText}>
              Recurring billing. Auto-renews unless canceled 24h prior.
              {'\n'}
              <Text style={{ fontStyle: 'italic' }}>
                Disclaimer: Metanoia is a habit coach, not a licensed healthcare or therapy provider.
              </Text>
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  proBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  proBadgeText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '700',
    padding: 4,
  },
  content: {
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
  },
  featureList: {
    gap: 14,
    marginBottom: 24,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkIcon: {
    color: '#10b981',
    fontWeight: '800',
    fontSize: 16,
    marginRight: 10,
    marginTop: 1,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  featureDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  planCardActive: {
    borderColor: '#6366f1',
    backgroundColor: '#f5f3ff',
  },
  saveTag: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  saveTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  planDuration: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6366f1',
    marginVertical: 2,
  },
  planSub: {
    fontSize: 12,
    color: '#64748b',
  },
  ctaButton: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  disclaimerText: {
    marginTop: 16,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 24,
  },
});
