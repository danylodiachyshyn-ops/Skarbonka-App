import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, LogOut } from 'lucide-react-native';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import PiggyBankCard from '@/src/components/PiggyBankCard';
import PiggyBankGrid from '@/src/components/PiggyBankGrid';
import AddMoneyModal from '@/src/components/AddMoneyModal';
import CreateGoalModal from '@/src/components/CreateGoalModal';
import { UserBox } from '@/src/lib/database.types';
import { DEFAULT_PIGGY_BANK_COLOR } from '@/src/lib/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DisplayItem = UserBox & { isCreateNew?: never } | { id: string; isCreateNew: true };

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, user } = useAuthStore();
  const {
    userBoxes,
    currentBoxIndex,
    setCurrentIndex,
    getCurrentBox,
    getTotalSavedThisMonth,
    fetchUserBoxes,
    archiveUserBox,
    loading,
  } = useBoxStore();

  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Завантажуємо дані користувача з Supabase при вході
  useEffect(() => {
    if (user?.id) {
      fetchUserBoxes();
    }
  }, [user?.id]);

  useEffect(() => {
    const activeBoxes = userBoxes.filter((b) => !b.is_archived);
    if (activeBoxes.length > 0 && carouselIndex >= activeBoxes.length) {
      setCarouselIndex(activeBoxes.length - 1);
      setCurrentIndex(activeBoxes.length - 1);
    }
  }, [userBoxes.length]);

  const displayItems: DisplayItem[] = [
    ...userBoxes.filter((b) => !b.is_archived),
    { id: 'create_new', isCreateNew: true },
  ];

  const currentBox: UserBox | null =
    carouselIndex < displayItems.length && !(displayItems[carouselIndex] as { isCreateNew?: boolean })?.isCreateNew
      ? (displayItems[carouselIndex] as UserBox)
      : null;
  const totalSaved = getTotalSavedThisMonth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleCreateGoal = () => {
    setShowCreateGoalModal(true);
  };

  const handleGoalCreated = async () => {
    setShowCreateGoalModal(false);
    await fetchUserBoxes();
    const activeBoxes = userBoxes.filter((b) => !b.is_archived);
    const newIndex = activeBoxes.length - 1;
    setCarouselIndex(newIndex);
    setCurrentIndex(newIndex);
  };

  const handleCloseGoal = async (boxId: string) => {
    try {
      await archiveUserBox(boxId);
      await fetchUserBoxes();
      // Use fresh state from store after fetch
      const freshBoxes = useBoxStore.getState().userBoxes;
      const activeBoxes = freshBoxes.filter((b) => !b.is_archived);
      const newIndex = activeBoxes.length > 0 ? Math.min(carouselIndex, activeBoxes.length - 1) : 0;
      setCarouselIndex(newIndex);
      setCurrentIndex(newIndex);
    } catch (e) {
      // Error shown in store; optionally show alert
      const err = useBoxStore.getState().error;
      if (err) Alert.alert('Error', err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row justify-between items-center px-6 pt-4 pb-2">
        <View>
          <Text className="text-gray-500 text-sm">Welcome back</Text>
          <Text className="text-gray-900 text-2xl font-bold">
            {user?.email?.split('@')[0] || 'User'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleSignOut}
          className="p-2"
          activeOpacity={0.7}
        >
          <LogOut size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 justify-center">
        {loading && userBoxes.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500 text-lg">Loading your boxes...</Text>
          </View>
        ) : (
          <FlatList
          data={displayItems}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            if ((item as { isCreateNew?: boolean }).isCreateNew) {
              return (
                <View style={{ width: SCREEN_WIDTH }} className="flex-1 justify-center items-center px-5">
                  <TouchableOpacity
                    onPress={handleCreateGoal}
                    className="w-[90%] h-[70%] border-2 border-dashed border-gray-300 rounded-3xl items-center justify-center bg-white"
                    activeOpacity={0.7}
                  >
                    <View className="w-16 h-16 bg-primary-100 rounded-full items-center justify-center mb-4">
                      <Plus size={32} color="#1F96D3" />
                    </View>
                    <Text className="text-gray-600 text-xl font-semibold">
                      Create New Goal
                    </Text>
                    <Text className="text-gray-400 text-sm mt-2">
                      Start saving for something new
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }

            const box = item as UserBox & { target_amount?: number | null; box_templates?: { total_amount?: number; currency?: string } | null };
            const targetAmount = box.target_amount ?? box.box_templates?.total_amount ?? null;
            const currency = box.box_templates?.currency ?? 'PLN';
            return (
              <View style={{ width: SCREEN_WIDTH }}>
                <PiggyBankCard
                  userBox={box}
                  index={index}
                  currentIndex={carouselIndex}
                  targetAmount={targetAmount}
                  currency={currency}
                  colorTheme={DEFAULT_PIGGY_BANK_COLOR}
                  onClose={handleCloseGoal}
                />
              </View>
            );
          }}
          onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCarouselIndex(index);
            if (!(displayItems[index] as { isCreateNew?: boolean })?.isCreateNew) {
              setCurrentIndex(index);
            }
          }}
        />
        )}
      </View>

      {currentBox && !currentBox.is_archived && (
        <View className="px-0 pb-8">
          <PiggyBankGrid userBox={currentBox} />

          <View className="px-6">
            <TouchableOpacity
              onPress={() => setShowAddMoneyModal(true)}
              className="bg-primary-500 rounded-2xl py-5 items-center shadow-lg mb-4"
              activeOpacity={0.8}
            >
              <Text className="text-white text-xl font-bold">Add Money</Text>
            </TouchableOpacity>
          </View>

          <View className="px-6 bg-white rounded-2xl mx-6 p-4 shadow-sm">
            <Text className="text-gray-500 text-sm mb-1">Total saved this month</Text>
            <Text className="text-gray-900 text-2xl font-bold">
              {new Intl.NumberFormat('pl-PL', {
                style: 'currency',
                currency: 'PLN',
                minimumFractionDigits: 0,
              }).format(totalSaved)}
            </Text>
          </View>
        </View>
      )}

      {showAddMoneyModal && (
        <AddMoneyModal
          visible={showAddMoneyModal}
          onClose={() => setShowAddMoneyModal(false)}
          userBox={currentBox}
        />
      )}

      {showCreateGoalModal && (
        <CreateGoalModal
          visible={showCreateGoalModal}
          onClose={() => setShowCreateGoalModal(false)}
          onGoalCreated={handleGoalCreated}
        />
      )}
    </SafeAreaView>
  );
}
