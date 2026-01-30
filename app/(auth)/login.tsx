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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    loading,
    error,
    clearError,
    requiresEmailConfirmation,
  } = useAuthStore();
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

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
    <View className="flex-1 bg-white">
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
              <Text className="text-slate-800 text-3xl font-bold mt-4">Skarbonka</Text>
              <Text className="text-slate-500 text-base mt-2">Your digital piggy bank</Text>
            </View>

            {/* Card container – same style as app (rounded-3xl, shadow-sm) */}
            <View className="bg-slate-50 rounded-3xl p-6 shadow-sm mb-6">
              {isSignUp && (
                <View className="mb-4">
                  <Text className="text-slate-500 text-sm mb-2">Username</Text>
                  <View className="flex-row items-center bg-white rounded-2xl px-4 py-4 shadow-sm border border-slate-100">
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
                <Text className="text-slate-500 text-sm mb-2">Email</Text>
                <View className="flex-row items-center bg-white rounded-2xl px-4 py-4 shadow-sm border border-slate-100">
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
                <Text className="text-slate-500 text-sm mb-2">Password</Text>
                <View className="flex-row items-center bg-white rounded-2xl px-4 py-4 shadow-sm border border-slate-100">
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
                  <Text className="text-slate-500 text-sm mb-2">Confirm Password</Text>
                  <View className="flex-row items-center bg-white rounded-2xl px-4 py-4 shadow-sm border border-slate-100">
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
              className="rounded-3xl py-5 items-center shadow-sm mb-4"
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

            {/* Toggle */}
            <TouchableOpacity
              onPress={() => {
                setIsSignUp(!isSignUp);
                setUsername('');
                setConfirmPassword('');
              }}
              className="py-2 mb-6"
            >
              <Text className="text-center text-slate-500 text-base">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text className="text-[#1F96D3] font-semibold">
                  {isSignUp ? 'Log In' : 'Sign Up'}
                </Text>
              </Text>
            </TouchableOpacity>

            {isSignUp && requiresEmailConfirmation && (
              <View className="mb-6 bg-slate-50 rounded-3xl p-4 border border-slate-100 shadow-sm">
                <Text className="text-slate-800 font-semibold mb-1">Confirm your email</Text>
                <Text className="text-slate-600 text-sm mb-3">
                  We sent a verification link to {email || 'your email'}.
                </Text>
                <TouchableOpacity
                  onPress={() => resendConfirmation(email)}
                  className="bg-white rounded-2xl py-3 items-center border border-slate-200"
                  activeOpacity={0.8}
                  disabled={!email}
                >
                  <Text className="text-[#1F96D3] font-semibold">Resend email</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-slate-200" />
              <Text className="mx-4 text-slate-500 text-sm">or continue with</Text>
              <View className="flex-1 h-px bg-slate-200" />
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
    </View>
  );
}
