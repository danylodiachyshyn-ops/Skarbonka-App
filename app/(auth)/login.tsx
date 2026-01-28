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
import { Mail, Lock } from 'lucide-react-native';
import Logo from '@/src/components/Logo';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Authentication failed');
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
        <View className="mb-6">
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
          onPress={() => setIsSignUp(!isSignUp)}
          className="py-2"
        >
          <Text className="text-center text-gray-600">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <Text className="text-primary-500 font-semibold">
              {isSignUp ? 'Log In' : 'Sign Up'}
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Social Auth Placeholders */}
        <View className="mt-8">
          <View className="flex-row items-center mb-4">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-4 text-gray-500 text-sm">or continue with</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          <View className="flex-row gap-4">
            {/* Google Button */}
            <TouchableOpacity
              className="flex-1 bg-white border border-gray-200 rounded-2xl py-4 items-center"
              activeOpacity={0.7}
              disabled
            >
              <Text className="text-gray-400 text-base font-medium">Google</Text>
            </TouchableOpacity>

            {/* Apple Button */}
            <TouchableOpacity
              className="flex-1 bg-white border border-gray-200 rounded-2xl py-4 items-center"
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
