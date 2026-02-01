import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock, User } from 'lucide-react-native';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { useLanguageContext } from '@/src/contexts/LanguageContext';
import Logo from '@/src/components/Logo';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const {
    signIn,
    signUp,
    signInWithGoogle,
    resendConfirmation,
    resetPasswordForEmail,
    loading,
    error,
    clearError,
    requiresEmailConfirmation,
  } = useAuthStore();
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const { t } = useLanguageContext();

  useEffect(() => {
    if (error) {
      Alert.alert(t('common.error'), error);
      clearError();
    }
  }, [error, clearError, t]);

  const handleAuth = async () => {
    if (isSignUp) {
      if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
        Alert.alert(t('common.error'), t('auth.fillAllFields'));
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert(t('common.error'), t('auth.passwordsDoNotMatch'));
        return;
      }
      if (password.length < 6) {
        Alert.alert(t('common.error'), t('auth.passwordMinLength'));
        return;
      }
      await signUp(email, password, username, confirmPassword);
    } else {
      if (!email.trim() || !password.trim()) {
        Alert.alert(t('common.error'), t('auth.fillAllFields'));
        return;
      }
      await signIn(email, password);
    }

    const { isAuthenticated, requiresEmailConfirmation: needsConfirm } = useAuthStore.getState();
    if (isAuthenticated) {
      router.replace('/(tabs)/home');
    } else if (needsConfirm) {
      Alert.alert(
        t('auth.checkYourEmail'),
        t('auth.checkEmailConfirmation')
      );
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert(t('common.error'), t('auth.enterYourEmail'));
      return;
    }
    setForgotSending(true);
    try {
      await resetPasswordForEmail(forgotEmail.trim());
      Alert.alert(t('auth.checkYourEmail'), t('auth.checkEmailReset'));
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('auth.failedToSendResetLink'));
    } finally {
      setForgotSending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      const { isAuthenticated } = useAuthStore.getState();
      if (isAuthenticated) {
        router.replace('/(tabs)/home');
      }
    } catch (e) {
      // Error already set in store
    } finally {
      setGoogleLoading(false);
    }
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View className="items-center mb-10">
                <Logo size={72} />
                <Text className="text-white text-3xl font-bold mt-4">Skarbonka</Text>
                <Text className="text-white/80 text-base mt-2">{t('auth.tagline')}</Text>
              </View>

            {/* Form – no white frame, transparent on gradient */}
            <View className="mb-6">
              {isSignUp && (
                <View className="mb-4">
                  <Text className="text-white/80 text-sm mb-2">{t('auth.username')}</Text>
                  <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                    <User size={20} color="#64748b" strokeWidth={2} />
                    <TextInput
                      className="flex-1 ml-3 text-slate-800 text-base"
                      placeholder={t('auth.username')}
                      placeholderTextColor="#94a3b8"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoComplete="username"
                    />
                  </View>
                </View>
              )}

              <View className={isSignUp ? 'mb-4' : 'mb-4'}>
                <Text className="text-white/80 text-sm mb-2">{t('auth.email')}</Text>
                <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                  <Mail size={20} color="#64748b" strokeWidth={2} />
                  <TextInput
                    className="flex-1 ml-3 text-slate-800 text-base"
                    placeholder={t('auth.email')}
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-white/80 text-sm mb-2">{t('auth.password')}</Text>
                <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                  <Lock size={20} color="#64748b" strokeWidth={2} />
                  <TextInput
                    className="flex-1 ml-3 text-slate-800 text-base"
                    placeholder={t('auth.password')}
                    placeholderTextColor="#94a3b8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                  />
                </View>
              </View>

              {isSignUp && (
                <View className="mb-4">
                  <Text className="text-white/80 text-sm mb-2">{t('auth.confirmPassword')}</Text>
                  <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                    <Lock size={20} color="#64748b" strokeWidth={2} />
                    <TextInput
                      className="flex-1 ml-3 text-slate-800 text-base"
                      placeholder={t('auth.confirmPassword')}
                      placeholderTextColor="#94a3b8"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Primary button – rounded-3xl, primary color */}
            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              className="rounded-3xl py-5 items-center shadow-sm mb-2"
              style={{ backgroundColor: '#1F96D3' }}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-lg font-bold">
                  {isSignUp ? t('auth.signUp') : t('auth.logIn')}
                </Text>
              )}
            </TouchableOpacity>

            {!isSignUp && (
              <TouchableOpacity
                onPress={() => setShowForgotPassword(true)}
                className="py-2 mb-2"
                activeOpacity={0.8}
              >
                <Text className="text-center text-white/80 text-sm">{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>
            )}

            {/* Toggle */}
            <TouchableOpacity
              onPress={() => {
                setIsSignUp(!isSignUp);
                setUsername('');
                setConfirmPassword('');
              }}
              className="py-2 mb-6"
            >
              <Text className="text-center text-white/80 text-base">
                {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
                <Text className="text-white font-semibold">
                  {isSignUp ? t('auth.logIn') : t('auth.signUp')}
                </Text>
              </Text>
            </TouchableOpacity>

            {isSignUp && requiresEmailConfirmation && (
              <View className="mb-6 rounded-3xl p-4 border border-white/30 bg-white/10">
                <Text className="text-white font-semibold mb-1">{t('auth.confirmEmail')}</Text>
                <Text className="text-white/80 text-sm mb-3">
                  {t('auth.weSentVerification', { email: email || 'your email' })}
                </Text>
                <TouchableOpacity
                  onPress={() => resendConfirmation(email)}
                  className="rounded-2xl py-3 items-center border border-white/30 bg-white/20"
                  activeOpacity={0.8}
                  disabled={!email}
                >
                  <Text className="text-white font-semibold">{t('auth.resendEmail')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-white/30" />
              <Text className="mx-4 text-white/70 text-sm">{t('auth.orContinueWith')}</Text>
              <View className="flex-1 h-px bg-white/30" />
            </View>

            {/* Social – same rounded-3xl style */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="flex-1 bg-white rounded-3xl py-4 items-center justify-center border border-slate-200 shadow-sm"
                activeOpacity={0.7}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color="#1F96D3" />
                ) : (
                  <Text className="text-slate-700 text-base font-semibold">{t('auth.google')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-slate-100 rounded-3xl py-4 items-center justify-center"
                activeOpacity={0.7}
                disabled
              >
                <Text className="text-slate-400 text-base font-semibold">{t('auth.apple')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </LinearGradient>

      {/* Forgot password modal */}
      <Modal visible={showForgotPassword} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center px-6">
          <View className="bg-white rounded-3xl p-6">
            <Text className="text-slate-800 text-xl font-bold mb-1">{t('auth.resetPassword')}</Text>
            <Text className="text-slate-500 text-sm mb-4">
              {t('auth.resetPasswordDesc')}
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-4"
              placeholder={t('auth.email')}
              placeholderTextColor="#94a3b8"
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!forgotSending}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowForgotPassword(false);
                  setForgotEmail('');
                }}
                disabled={forgotSending}
                className="flex-1 rounded-xl py-3.5 bg-slate-100 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-slate-700 font-semibold">{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={forgotSending}
                className="flex-1 rounded-xl py-3.5 items-center"
                style={{ backgroundColor: '#1F96D3' }}
                activeOpacity={0.8}
              >
                {forgotSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="text-white font-semibold">{t('auth.sendLink')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
