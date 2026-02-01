import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Alert, Modal, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, LogOut, Pencil, Globe, Lock, MessageCircle, Archive } from 'lucide-react-native';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { useHomeCurrency } from '@/src/hooks/useHomeCurrency';
import { useLanguageContext } from '@/src/contexts/LanguageContext';
import { supabase } from '@/src/lib/supabase';
import { SUPPORTED_CURRENCIES, SupportedCurrency } from '@/src/lib/currencyApi';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@skarbonka.app';

const getCurrencyLabel = (code: SupportedCurrency, t: (k: string) => string) =>
  t(`currency.${code.toLowerCase()}`);

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
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const { homeCurrency, setHomeCurrency } = useHomeCurrency();
  const { language, setLanguage, t } = useLanguageContext();

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
      Alert.alert(t('common.error'), t('profile.couldNotUpdateName'));
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
      Alert.alert(t('common.error'), t('profile.fillAllPasswordFields'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('profile.wrongPassword'), t('profile.passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('profile.passwordMinLength'));
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('profile.done'), t('profile.passwordUpdated'));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update password';
      if (message === 'Current password is incorrect') {
        Alert.alert(t('profile.wrongPassword'), t('profile.currentPasswordIncorrect'));
      } else {
        Alert.alert(t('common.error'), message);
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
      Alert.alert(t('common.error'), t('profile.couldNotOpenEmail'));
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
            <Text className="text-white text-lg font-semibold ml-3">{t('profile.title')}</Text>
          </View>

          {/* User info card */}
          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            <View className="rounded-2xl overflow-hidden bg-white/10 p-6">
              <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center self-center mb-4">
                <Text className="text-white text-2xl font-bold">{initials}</Text>
              </View>

              {/* Name row: display or edit */}
              <View className="mb-4">
                <Text className="text-white/80 text-sm mb-1">{t('profile.name')}</Text>
                {loadingProfile ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                ) : isEditingName ? (
                  <View className="flex-row items-center gap-2 mt-1">
                    <TextInput
                      className="flex-1 bg-white/20 rounded-xl px-4 py-3 text-white text-base"
                      placeholder={t('profile.yourName')}
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
                        <Text className="text-white font-semibold">{t('common.save')}</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={cancelEditingName}
                      disabled={savingName}
                      className="rounded-xl py-3 px-4 bg-white/20"
                      activeOpacity={0.8}
                    >
                      <Text className="text-white font-medium">{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={startEditingName}
                    className="flex-row items-center justify-between bg-white/10 rounded-xl px-4 py-3 mt-1"
                    activeOpacity={0.8}
                  >
                    <Text className="text-white text-base font-medium" numberOfLines={1}>
                      {fullName?.trim() || t('profile.addYourName')}
                    </Text>
                    <Pencil size={18} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>

              <Text className="text-white/80 text-sm text-center mb-1">{t('auth.email')}</Text>
              <Text className="text-white text-base font-medium text-center mb-6" numberOfLines={1}>
                {displayEmail}
              </Text>

              {/* Language */}
              <TouchableOpacity
                onPress={() => setShowLanguageModal(true)}
                className="flex-row items-center justify-between rounded-xl py-3.5 px-4 bg-white/10 mb-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Globe size={20} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ marginRight: 12 }} />
                  <Text className="text-white font-medium">{t('profile.language')}</Text>
                </View>
                <Text className="text-white/80 text-base">{t(`languages.${language}`)}</Text>
              </TouchableOpacity>

              {/* Home currency (for conversion on jar cards) */}
              <TouchableOpacity
                onPress={() => setShowHomeCurrencyModal(true)}
                className="flex-row items-center justify-between rounded-xl py-3.5 px-4 bg-white/10 mb-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Text className="text-white font-medium">{t('profile.homeCurrency')}</Text>
                </View>
                <Text className="text-white/80 text-base">
                  {homeCurrency ? getCurrencyLabel(homeCurrency, t) : t('common.none')}
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
                    <Text className="text-white font-medium">{t('profile.changePassword')}</Text>
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
                  <Text className="text-white font-medium">{t('profile.support')}</Text>
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
                  <Text className="text-white font-medium">{t('profile.archive')}</Text>
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
                    <Text className="text-white font-semibold">{t('profile.logOut')}</Text>
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
            <Text className="text-slate-800 text-xl font-bold mb-2">{t('profile.homeCurrencyModalTitle')}</Text>
            <Text className="text-slate-500 text-sm mb-4">
              {t('profile.homeCurrencyModalDesc')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setHomeCurrency(null);
                setShowHomeCurrencyModal(false);
              }}
              className="rounded-xl py-3.5 px-4 bg-slate-100 mb-2"
              activeOpacity={0.8}
            >
              <Text className="text-slate-700 font-medium">{t('common.none')}</Text>
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
                <Text className="text-slate-800 font-medium">{getCurrencyLabel(code, t)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowHomeCurrencyModal(false)}
              className="rounded-xl py-3.5 mt-2 bg-slate-200 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-slate-700 font-semibold">{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language modal */}
      <Modal visible={showLanguageModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-3xl p-6">
            <Text className="text-slate-800 text-xl font-bold mb-2">{t('profile.language')}</Text>
            {(['en', 'de', 'uk'] as const).map((code) => (
              <TouchableOpacity
                key={code}
                onPress={() => {
                  setLanguage(code);
                  setShowLanguageModal(false);
                }}
                className="rounded-xl py-3.5 px-4 bg-slate-100 mb-2"
                activeOpacity={0.8}
              >
                <Text className="text-slate-800 font-medium">{t(`languages.${code}`)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setShowLanguageModal(false)}
              className="rounded-xl py-3.5 mt-2 bg-slate-200 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-slate-700 font-semibold">{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <Modal visible={showChangePassword} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-3xl p-6">
            <Text className="text-slate-800 text-xl font-bold mb-1">{t('profile.changePasswordTitle')}</Text>
            <Text className="text-slate-600 text-sm font-medium mb-1.5">
              {t('profile.currentPassword')}
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-4"
              placeholder={t('profile.enterCurrentPassword')}
              placeholderTextColor="#94a3b8"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              editable={!savingPassword}
            />
            <Text className="text-slate-600 text-sm font-medium mb-1.5">{t('profile.newPassword')}</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-3"
              placeholder={t('profile.enterNewPassword')}
              placeholderTextColor="#94a3b8"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!savingPassword}
            />
            <Text className="text-slate-600 text-sm font-medium mb-1.5">
              {t('profile.confirmPassword')}
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-4"
              placeholder={t('profile.enterNewPasswordAgain')}
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
                <Text className="text-slate-700 font-semibold">{t('common.cancel')}</Text>
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
                  <Text className="text-white font-semibold">{t('common.update')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
