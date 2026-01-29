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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { Mail, Lock, User } from 'lucide-react-native';
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
    // Validation for Sign Up
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
      // Validation for Sign In
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-8">
        {/* Logo/Header */}
        <View className="items-center mb-12">
          <Logo size={80} />
          <Text className="text-3xl font-bold text-gray-900 mt-4">Skarbonka</Text>
          <Text className="text-gray-500 mt-2">Your digital piggy bank</Text>
        </View>

        {/* Username Input - Only for Sign Up */}
        {isSignUp && (
          <View className="mb-4">
            <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-200">
              <User size={20} color="#6b7280" />
              <TextInput
                className="flex-1 ml-3 text-gray-900 text-base"
                placeholder="Username"
                placeholderTextColor="#9ca3af"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
              />
            </View>
          </View>
        )}

        {/* Email Input */}
        <View className="mb-4">
          <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-200">
            <Mail size={20} color="#6b7280" />
            <TextInput
              className="flex-1 ml-3 text-gray-900 text-base"
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
        </View>

        {/* Password Input */}
        <View className="mb-4">
          <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-200">
            <Lock size={20} color="#6b7280" />
            <TextInput
              className="flex-1 ml-3 text-gray-900 text-base"
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />
          </View>
        </View>

        {/* Confirm Password Input - Only for Sign Up */}
        {isSignUp && (
          <View className="mb-6">
            <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-4 border border-gray-200">
              <Lock size={20} color="#6b7280" />
              <TextInput
                className="flex-1 ml-3 text-gray-900 text-base"
                placeholder="Confirm Password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            </View>
          </View>
        )}

        {/* Auth Button */}
        <TouchableOpacity
          onPress={handleAuth}
          disabled={loading}
          className="bg-primary-500 rounded-2xl py-4 items-center shadow-lg mb-4"
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-lg font-semibold">
              {isSignUp ? 'Sign Up' : 'Log In'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Toggle Sign Up/Log In */}
        <TouchableOpacity
          onPress={() => {
            setIsSignUp(!isSignUp);
            // Clear form when switching modes
            setUsername('');
            setConfirmPassword('');
          }}
          className="py-2"
        >
          <Text className="text-center text-gray-600">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text className="text-primary-500 font-semibold">
              {isSignUp ? 'Log In' : 'Sign Up'}
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Email Confirmation */}
        {isSignUp && requiresEmailConfirmation && (
          <View className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <Text className="text-blue-900 font-semibold mb-1">Confirm your email</Text>
            <Text className="text-blue-700 text-sm mb-3">
              We sent a verification link to {email || 'your email'}.
            </Text>
            <TouchableOpacity
              onPress={() => resendConfirmation(email)}
              className="bg-white border border-blue-200 rounded-xl py-3 items-center"
              activeOpacity={0.8}
              disabled={!email}
            >
              <Text className="text-blue-700 font-semibold">Resend email</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Social Auth */}
        <View className="mt-8">
          <View className="flex-row items-center mb-4">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-4 text-gray-500 text-sm">or continue with</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          <View className="flex-row justify-between" style={{ gap: 12 }}>
            {/* Google Button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="flex-1 bg-white border border-gray-200 rounded-2xl py-4 items-center justify-center"
              activeOpacity={0.7}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#1F96D3" />
              ) : (
                <Text className="text-gray-700 text-base font-medium">Google</Text>
              )}
            </TouchableOpacity>

            {/* Apple Button - placeholder */}
            <TouchableOpacity
              className="flex-1 bg-gray-900 rounded-2xl py-4 items-center justify-center"
              activeOpacity={0.7}
              disabled
            >
              <Text className="text-gray-400 text-base font-medium">Apple</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
