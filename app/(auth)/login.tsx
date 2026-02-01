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

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  const handleAuth = async () => {
    if (isSignUp) {
      if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }
      await signUp(email, password, username, confirmPassword);
    } else {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      await signIn(email, password);
    }

    const { isAuthenticated, requiresEmailConfirmation: needsConfirm } = useAuthStore.getState();
    if (isAuthenticated) {
      router.replace('/(tabs)/home');
    } else if (needsConfirm) {
      Alert.alert(
        'Check your email',
        'We sent you a confirmation link. Please verify your email to continue.'
      );
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Error', 'Enter your email address');
      return;
    }
    setForgotSending(true);
    try {
      await resetPasswordForEmail(forgotEmail.trim());
      Alert.alert('Check your email', 'We sent you a link to reset your password.');
      setShowForgotPassword(false);
      setForgotEmail('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send reset link');
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
                <Text className="text-white/80 text-base mt-2">Your digital piggy bank</Text>
              </View>

            {/* Form – no white frame, transparent on gradient */}
            <View className="mb-6">
              {isSignUp && (
                <View className="mb-4">
                  <Text className="text-white/80 text-sm mb-2">Username</Text>
                  <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                    <User size={20} color="#64748b" strokeWidth={2} />
                    <TextInput
                      className="flex-1 ml-3 text-slate-800 text-base"
                      placeholder="Username"
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
                <Text className="text-white/80 text-sm mb-2">Email</Text>
                <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                  <Mail size={20} color="#64748b" strokeWidth={2} />
                  <TextInput
                    className="flex-1 ml-3 text-slate-800 text-base"
                    placeholder="Email"
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
                <Text className="text-white/80 text-sm mb-2">Password</Text>
                <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                  <Lock size={20} color="#64748b" strokeWidth={2} />
                  <TextInput
                    className="flex-1 ml-3 text-slate-800 text-base"
                    placeholder="Password"
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
                  <Text className="text-white/80 text-sm mb-2">Confirm Password</Text>
                  <View className="flex-row items-center rounded-2xl px-4 py-4 bg-white border border-slate-100">
                    <Lock size={20} color="#64748b" strokeWidth={2} />
                    <TextInput
                      className="flex-1 ml-3 text-slate-800 text-base"
                      placeholder="Confirm Password"
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
                  {isSignUp ? 'Sign Up' : 'Log In'}
                </Text>
              )}
            </TouchableOpacity>

            {!isSignUp && (
              <TouchableOpacity
                onPress={() => setShowForgotPassword(true)}
                className="py-2 mb-2"
                activeOpacity={0.8}
              >
                <Text className="text-center text-white/80 text-sm">Forgot password?</Text>
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
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text className="text-white font-semibold">
                  {isSignUp ? 'Log In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>

            {isSignUp && requiresEmailConfirmation && (
              <View className="mb-6 rounded-3xl p-4 border border-white/30 bg-white/10">
                <Text className="text-white font-semibold mb-1">Confirm your email</Text>
                <Text className="text-white/80 text-sm mb-3">
                  We sent a verification link to {email || 'your email'}.
                </Text>
                <TouchableOpacity
                  onPress={() => resendConfirmation(email)}
                  className="rounded-2xl py-3 items-center border border-white/30 bg-white/20"
                  activeOpacity={0.8}
                  disabled={!email}
                >
                  <Text className="text-white font-semibold">Resend email</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-white/30" />
              <Text className="mx-4 text-white/70 text-sm">or continue with</Text>
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
                  <Text className="text-slate-700 text-base font-semibold">Google</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-slate-100 rounded-3xl py-4 items-center justify-center"
                activeOpacity={0.7}
                disabled
              >
                <Text className="text-slate-400 text-base font-semibold">Apple</Text>
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
            <Text className="text-slate-800 text-xl font-bold mb-1">Reset password</Text>
            <Text className="text-slate-500 text-sm mb-4">
              Enter your email and we'll send you a link to reset your password.
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base mb-4"
              placeholder="Email"
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
                <Text className="text-slate-700 font-semibold">Cancel</Text>
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
                  <Text className="text-white font-semibold">Send link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
