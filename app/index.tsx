import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, getToken, setToken } from '../lib/api';
import { palette } from '../lib/theme';
import type { Plan, User } from '../lib/types';

const screens = [
  { href: '/senator-directory', title: 'State Legislator Directory', blurb: 'Find state legislators through a state-by-state directory and contact source.', icon: 'people-outline' as const },
  { href: '/letter-generator', title: 'Letter Generator', blurb: 'Draft and customize sponsor letters for constituents.', icon: 'document-text-outline' as const },
  { href: '/packet-builder', title: 'Packet Builder', blurb: 'Create custom legislative review packets for law consideration.', icon: 'folder-open-outline' as const },
  { href: '/foia-guide', title: 'FOIA Guide', blurb: 'Access paperwork templates and instructions to obtain public records.', icon: 'shield-checkmark-outline' as const },
  { href: '/law-steps', title: 'The steps it takes to get a law passed', blurb: 'Follow the core legislative path from introduction to governor action.', icon: 'git-branch-outline' as const },
];

const plans: Plan[] = [
  { id: 'weekly', name: 'Weekly', priceLabel: '$9/week', amount: 900, interval: 'week', description: 'Short-term access for one active campaign.' },
  { id: 'monthly', name: 'Monthly', priceLabel: '$29/month', amount: 2900, interval: 'month', description: 'Best for ongoing packet drafting and outreach.' },
  { id: 'yearly', name: 'Yearly', priceLabel: '$249/year', amount: 24900, interval: 'year', description: 'Full-year access for long legislative cycles.' },
];

type MeResponse = { user: User; subscription?: { active: boolean; planId?: string | null; currentPeriodEnd?: string | null } | null };
type PaymentStatus = { connected: boolean };

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<MeResponse['subscription']>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [paymentConnected, setPaymentConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [billingNote, setBillingNote] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const token = await getToken();
      const [pay, me] = await Promise.all([
        api<PaymentStatus>('GET', '/api/payments/status').catch(() => ({ connected: false })),
        token ? api<MeResponse>('GET', '/api/auth/me') : Promise.resolve(null),
      ]);
      setPaymentConnected(!!pay.connected);
      if (me) {
        setUser(me.user);
        setSubscription(me.subscription || null);
      } else {
        setUser(null);
        setSubscription(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const submitAuth = async () => {
    setSubmitting(true);
    setError('');
    try {
      const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const result = await api<{ token: string; user: User }>('POST', path, { email, password, name });
      await setToken(result.token);
      setUser(result.user);
      setName('');
      setPassword('');
      setEmail('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      await api('POST', '/api/auth/logout');
    } catch {}
    await setToken(null);
    setUser(null);
    setSubscription(null);
  };

  const startCheckout = async (plan: Plan) => {
    setBillingNote('');
    setError('');
    try {
      const result = await api<{ url?: string; error?: string }>('POST', '/api/payments/checkout', { planId: plan.id });
      if (result.url) {
        await Linking.openURL(result.url);
        setBillingNote('Checkout opened in your browser. Return here after payment.');
      } else {
        setBillingNote(result.error || 'Payments are not connected yet.');
      }
    } catch (e) {
      setBillingNote((e as Error).message);
    }
  };

  const planBadge = useMemo(() => {
    if (!subscription?.active || !subscription?.planId) return 'No active subscription';
    return `Active: ${subscription.planId}`;
  }, [subscription]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.accent} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.eyebrow}>Legislative packet work, without the mess</Text>
            <View style={styles.planPill}><Text style={styles.planPillText}>{planBadge}</Text></View>
          </View>
          <Text style={styles.title}>Build review packets, FOIA paperwork, senator outreach, and sponsor letters in one noir workspace.</Text>
          <Text style={styles.subtitle}>The app is tuned for people doing real legislative prep: contact lookup, constituent letter drafting, packet assembly, records requests, and a plain-language guide to getting a law passed.</Text>
          <View style={styles.heroStats}>
            <View style={styles.statCard}><Text style={styles.statLabel}>Subscription</Text><Text style={styles.statValue}>{paymentConnected ? 'Ready' : 'Connect Stripe to charge users'}</Text></View>
            <View style={styles.statCard}><Text style={styles.statLabel}>Access</Text><Text style={styles.statValue}>{user ? user.email : 'Sign in required'}</Text></View>
          </View>
        </View>

        {loading ? <ActivityIndicator color={palette.accent} style={{ marginTop: 30 }} /> : null}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {!user ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sign in</Text>
            <Text style={styles.sectionNote}>Keep it simple: create an account, then unlock a subscription.</Text>
            <View style={styles.modeRow}>
              {(['signup', 'login'] as const).map((item) => (
                <Pressable key={item} style={[styles.modeChip, mode === item && styles.modeChipActive]} onPress={() => setMode(item)} accessibilityRole="button">
                  <Text style={[styles.modeChipText, mode === item && styles.modeChipTextActive]}>{item === 'signup' ? 'Create account' : 'Log in'}</Text>
                </Pressable>
              ))}
            </View>
            {mode === 'signup' && (
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#8d8d8d" />
            )}
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#8d8d8d" />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#8d8d8d" />
            <Pressable style={styles.primaryButton} onPress={submitAuth} accessibilityRole="button" disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Working...' : mode === 'signup' ? 'Create account' : 'Log in'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View>
                <Text style={styles.sectionTitle}>Signed in</Text>
                <Text style={styles.sectionNote}>{user.name || 'Legislative advocate'} · {user.email}</Text>
              </View>
              <Pressable style={styles.ghostButton} onPress={logout} accessibilityRole="button">
                <Text style={styles.ghostButtonText}>Log out</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Subscriptions</Text>
          <Text style={styles.sectionNote}>Paid access is set up for weekly, monthly, and yearly subscriptions.</Text>
          {plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.priceLabel}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>
              <Pressable style={[styles.primaryButton, !user && styles.buttonDisabled]} onPress={() => startCheckout(plan)} disabled={!user} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Subscribe</Text>
              </Pressable>
            </View>
          ))}
          <Text style={styles.helper}>{paymentConnected ? 'Stripe is connected. Checkout opens in the browser and returns here.' : 'Stripe is not connected yet. The payment UI is ready, but the owner still needs to connect Stripe.'}</Text>
          {!!billingNote && <Text style={styles.helper}>{billingNote}</Text>}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Workspace</Text>
          <Text style={styles.sectionNote}>The screens stay in the approved order.</Text>
        </View>
        {screens.map((screen) => (
          <Pressable key={screen.href} style={styles.navCard} onPress={() => router.push(screen.href as never)} accessibilityRole="button">
            <View style={styles.navIcon}><Ionicons name={screen.icon} size={22} color={palette.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>{screen.title}</Text>
              <Text style={styles.navBlurb}>{screen.blurb}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.text} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 20, paddingBottom: 44 },
  hero: { backgroundColor: palette.card, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: palette.line, marginBottom: 18 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { color: palette.softText, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', flex: 1 },
  planPill: { backgroundColor: palette.muted, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  planPillText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  title: { color: palette.text, fontSize: 30, fontWeight: '800', lineHeight: 38, marginBottom: 10 },
  subtitle: { color: '#d4d4d8', fontSize: 15, lineHeight: 23 },
  heroStats: { marginTop: 18, gap: 12 },
  statCard: { backgroundColor: '#101010', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.line },
  statLabel: { color: '#a3a3a3', fontSize: 12, textTransform: 'uppercase', marginBottom: 6 },
  statValue: { color: palette.text, fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: palette.card, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: palette.line, marginBottom: 18 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { color: palette.text, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sectionNote: { color: '#cfcfcf', fontSize: 14, lineHeight: 21 },
  error: { color: palette.danger, fontSize: 14, marginBottom: 14 },
  modeRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  modeChip: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: '#101010' },
  modeChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  modeChipText: { color: palette.text, fontWeight: '700' },
  modeChipTextActive: { color: '#0a0a0a' },
  input: { backgroundColor: '#101010', borderRadius: 16, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 16, paddingVertical: 14, color: palette.text, fontSize: 16, marginBottom: 12 },
  primaryButton: { backgroundColor: palette.accent, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minWidth: 112 },
  primaryButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
  ghostButton: { borderRadius: 14, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, paddingVertical: 12 },
  ghostButtonText: { color: palette.text, fontWeight: '700' },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, alignItems: 'center' },
  planCard: { flexDirection: 'row', gap: 14, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: '#101010', padding: 16, marginTop: 12, alignItems: 'center' },
  planName: { color: palette.text, fontSize: 18, fontWeight: '800' },
  planPrice: { color: palette.accent, fontSize: 15, fontWeight: '700', marginTop: 4 },
  planDescription: { color: '#d4d4d8', fontSize: 13, lineHeight: 19, marginTop: 6 },
  helper: { color: '#bfbfbf', fontSize: 13, lineHeight: 19, marginTop: 12 },
  buttonDisabled: { opacity: 0.45 },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: palette.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.line, marginBottom: 12 },
  navIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#101010', alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: 5 },
  navBlurb: { color: '#cfcfcf', fontSize: 14, lineHeight: 20 },
});
