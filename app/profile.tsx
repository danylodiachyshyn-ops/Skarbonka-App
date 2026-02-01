import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Alert, Modal, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, LogOut, Pencil, Globe, Lock, MessageCircle, Archive } from 'lucide-react-native';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { useHomeCurrency } from '@/src/hooks/useHomeCurrency';
import { supabase } from '@/src/lib/supabase';
import { SUPPORTED_CURRENCIES, SupportedCurrency } from '@/src/lib/currencyApi';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@skarbonka.app';

const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  EUR: '€ Euro',
  USD: '$ US Dollar',
  UAH: '₴ Hryvnia',
  GBP: '£ British Pound',
};

const DISPLAY_LANGUAGE = 'English';

export default function ProfileScreen() {
  const { user, session, signOut, updatePassword, loading } = useAuthStore();
  const router = useRouter();
  const [fullName, setFullName] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showHomeCurrencyModal, setShowHomeCurrencyModal] = useState(false);
  const { homeCurrency, setHomeCurrency } = useHomeCurrency();

  const isEmailProvider = (session?.user?.app_metadata?.provider as string) === 'email';

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';
  const displayEmail = user?.email ?? 'Not signed in';

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoadingProfile(true);
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    setFullName(data?.full_name ?? null);
    setLoadingProfile(false);
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEditingName = () => {
    setEditNameValue(fullName ?? '');
    setIsEditingName(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setEditNameValue('');
  };

  const saveName = async () => {
    const trimmed = editNameValue.trim();
    if (!user?.id) return;
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed || null })
      .eq('id', user.id);
    setSavingName(false);
    if (error) {
      Alert.alert('Error', 'Could not update name.');
      return;
    }
    setFullName(trimmed || null);
    setIsEditingName(false);
    setEditNameValue('');
  };

  const handleLogOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'The new password and confirmation do not match. Please enter the same password in both fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Done', 'Your password has been updated.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update password';
      if (message === 'Current password is incorrect') {
        Alert.alert('Wrong password', 'The current password you entered is incorrect. Please try again.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const openSupport = () => {
    const subject = encodeURIComponent('Skarbonka Support');
    const url = Platform.select({
      ios: `mailto:${SUPPORT_EMAIL}?subject=${subject}`,
      android: `mailto:${SUPPORT_EMAIL}?subject=${subject}`,
      default: `mailto:${SUPPORT_EMAIL}?subject=${subject}`,
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open email app.');
    });
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#0f172a', '#1e3a5f', '#1e40af']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Header with back */}
          <View className="flex-row items-center px-4 pt-2 pb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
              activeOpacity={0.8}
            >
              <ChevronLeft size={22} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold ml-3">Profile</Text>
          </View>

          {/* User info card */}
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <View className="rounded-2xl overflow-hidden bg-white/10 p-6">
              <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center self-center mb-4">
                <Text className="text-white text-2xl font-bold">{initials}</Text>
              </View>

              {/* Name row: display or edit */}
              <View className="mb-4">
                <Text className="text-white/80 text-sm mb-1">Name</Text>
                {loadingProfile ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                ) : isEditingName ? (
                  <View className="flex-row items-center gap-2 mt-1">
                    <TextInput
                      className="flex-1 bg-white/20 rounded-xl px-4 py-3 text-white text-base"
                      placeholder="Your name"
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      value={editNameValue}
                      onChangeText={setEditNameValue}
                      autoFocus
                      editable={!savingName}
                    />
                    <TouchableOpacity
                      onPress={saveName}
                      disabled={savingName}
                      className="rounded-xl py-3 px-4 bg-white/30"
                      activeOpacity={0.8}
                    >
                      {savingName ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">Save</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={cancelEditingName}
                      disabled={savingName}
                      className="rounded-xl py-3 px-4 bg-white/20"
                      activeOpacity={0.8}
                    >
                      <Text className="text-white font-medium">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={startEditingName}
                    className="flex-row items-center justify-between bg-white/10 rounded-xl px-4 py-3 mt-1"
                    activeOpacity={0.8}
                  >
                    <Text className="text-white text-base font-medium" numberOfLines={1}>
                      {fullName?.trim() || 'Add your name'}
                    </Text>
                    <Pencil size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>

              <Text className="text-white/80 text-sm text-center mb-1">Email</Text>
              <Text className="text-white text-base font-medium text-center mb-6" numberOfLines={1}>
                {displayEmail}
              </Text>

              {/* Language (no functionality yet) */}
              <TouchableOpacity
                className="flex-row items-center justify-between rounded-xl py-3.5 px-4 bg-white/10 mb-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Globe size={20} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ marginRight: 12 }} />
                  <Text className="text-white font-medium">Language</Text>
                </View>
                <Text className="text-white/80 text-base">{DISPLAY_LANGUAGE}</Text>
              </TouchableOpacity>

              {/* Home currency (for conversion on jar cards) */}
              <TouchableOpacity
                onPress={() => setShowHomeCurrencyModal(true)}
                className="flex-row items-center justify-between rounded-xl py-3.5 px-4 bg-white/10 mb-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Text className="text-white font-medium">Home currency</Text>
                </View>
                <Text className="text-white/80 text-base">
                  {homeCurrency ? CURRENCY_LABELS[homeCurrency] : 'None'}
                </Text>
              </TouchableOpacity>

              {/* Security: Change password (email users only) */}
              {isEmailProvider && (
                <TouchableOpacity
                  onPress={() => setShowChangePassword(true)}
                  className="flex-row items-center justify-between rounded-xl py-3.5 px-4 bg-white/10 mb-4"
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center">
                    <Lock size={20} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ marginRight: 12 }} />
                    <Text className="text-white font-medium">Change password</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Support */}
              <TouchableOpacity
                onPress={openSupport}
                className="flex-row items-center justify-between rounded-xl py-3.5 px-4 bg-white/10 mb-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <MessageCircle size={20} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ marginRight: 12 }} />
                  <Text className="text-white font-medium">Support</Text>
                </View>
              </TouchableOpacity>

              {/* Archive */}
              <TouchableOpacity
                onPress={() => router.push('/archive')}
                className="flex-row items-center justify-between rounded-xl py-3.5 px-4 bg-white/10 mb-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Archive size={20} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ marginRight: 12 }} />
                  <Text className="text-white font-medium">Archive</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogOut}
                disabled={loading}
                className="flex-row items-center justify-center rounded-xl py-3.5 bg-white/20"
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <LogOut size={20} color="#fff" strokeWidth={2} style={{ marginRight: 8 }} />
                    <Text className="text-white font-semibold">Log out</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Home currency modal */}
      <Modal visible={showHomeCurrencyModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-3xl p-6">
            <Text className="text-slate-800 text-xl font-bold mb-2">Home currency</Text>
            <Text className="text-slate-500 text-sm mb-4">
              Jar balances will be shown in this currency when different.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setHomeCurrency(null);
                setShowHomeCurrencyModal(false);
              }}
              className="rounded-xl py-3.5 px-4 bg-slate-100 mb-2"
              activeOpacity={0.8}
            >
              <Text className="text-slate-700 font-medium">None</Text>
            </TouchableOpacity>
            {SUPPORTED_CURRENCIES.map((code) => (
              <TouchableOpacity
                key={code}
                onPress={() => {
                  setHomeCurrency(code);
                  setShowHomeCurrencyModal(false);
                }}
                className="rounded-xl py-3.5 px-4 bg-slate-100 mb-2"
                activeOpacity={0.8}
              >
                <Text className="text-slate-800 font-medium">{CURRENCY_LABELS[code]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowHomeCurrencyModal(false)}
              className="rounded-xl py-3.5 mt-2 bg-slate-200 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-slate-700 font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <Modal visible={showChangePassword} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-3xl p-6">
            <Text className="text-slate-800 text-xl font-bold mb-1">Change password</Text>
            <Text className="text-slate-600 text-sm font-medium mb-1.5">
              Current password
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-4"
              placeholder="Enter current password"
              placeholderTextColor="#94a3b8"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              editable={!savingPassword}
            />
            <Text className="text-slate-600 text-sm font-medium mb-1.5">New password</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-3"
              placeholder="Enter new password"
              placeholderTextColor="#94a3b8"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!savingPassword}
            />
            <Text className="text-slate-600 text-sm font-medium mb-1.5">
              Confirm new password
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-4"
              placeholder="Enter new password again"
              placeholderTextColor="#94a3b8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!savingPassword}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowChangePassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={savingPassword}
                className="flex-1 rounded-xl py-3.5 bg-slate-100 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-slate-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={savingPassword}
                className="flex-1 rounded-xl py-3.5 items-center"
                style={{ backgroundColor: '#1F96D3' }}
                activeOpacity={0.8}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
