import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, LogOut, Pencil, Globe } from 'lucide-react-native';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { supabase } from '@/src/lib/supabase';

const DISPLAY_LANGUAGE = 'English';

export default function ProfileScreen() {
  const { user, signOut, loading } = useAuthStore();
  const router = useRouter();
  const [fullName, setFullName] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

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
    </View>
  );
}
