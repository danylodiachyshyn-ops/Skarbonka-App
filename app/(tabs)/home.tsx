import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, LogOut } from 'lucide-react-native';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { usePiggyBankStore } from '@/src/hooks/usePiggyBankStore';
import PiggyBankCard from '@/src/components/PiggyBankCard';
import AddMoneyModal from '@/src/components/AddMoneyModal';
import CreateGoalModal from '@/src/components/CreateGoalModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, user } = useAuthStore();
  const {
    piggyBanks,
    currentPiggyBankIndex,
    setCurrentIndex,
    getCurrentPiggyBank,
    getTotalSavedThisMonth,
    setPiggyBanks,
  } = usePiggyBankStore();

  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Initialize with mock data for demo
  useEffect(() => {
    if (piggyBanks.length === 0) {
      setPiggyBanks([
        {
          id: '1',
          user_id: 'mock_user_1',
          name: 'Vacation',
          target_amount: 5000,
          current_amount: 1250,
          currency: 'PLN',
          color_theme: '#1F96D3',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: '2',
          user_id: 'mock_user_1',
          name: 'New Laptop',
          target_amount: 3000,
          current_amount: 1800,
          currency: 'PLN',
          color_theme: '#10b981',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    }
  }, []);

  // Update carousel index when piggy banks change
  useEffect(() => {
    const activeBanks = piggyBanks.filter((bank) => !bank.is_archived);
    if (activeBanks.length > 0 && carouselIndex >= activeBanks.length) {
      setCarouselIndex(activeBanks.length - 1);
      setCurrentIndex(activeBanks.length - 1);
    }
  }, [piggyBanks.length]);

  // Add "Create New" card to the end
  const displayBanks = [
    ...piggyBanks.filter((bank) => !bank.is_archived),
    { id: 'create_new', isCreateNew: true } as any,
  ];

  const currentPiggyBank =
    carouselIndex < displayBanks.length && !displayBanks[carouselIndex]?.isCreateNew
      ? displayBanks[carouselIndex]
      : null;
  const totalSaved = getTotalSavedThisMonth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const handleCreateGoal = () => {
    setShowCreateGoalModal(true);
  };

  const handleGoalCreated = () => {
    setShowCreateGoalModal(false);
    // Navigate to the newly created goal (last item before create_new)
    const activeBanks = piggyBanks.filter((bank) => !bank.is_archived);
    const newIndex = activeBanks.length - 1;
    setCarouselIndex(newIndex);
    setCurrentIndex(newIndex);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
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

      {/* Carousel */}
      <View className="flex-1 justify-center">
        <FlatList
          data={displayBanks}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            if (item.isCreateNew) {
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

            return (
              <View style={{ width: SCREEN_WIDTH }}>
                <PiggyBankCard
                  piggyBank={item}
                  index={index}
                  currentIndex={carouselIndex}
                />
              </View>
            );
          }}
          onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCarouselIndex(index);
            if (!displayBanks[index]?.isCreateNew) {
              setCurrentIndex(index);
            }
          }}
        />
      </View>

      {/* Action Area */}
      {currentPiggyBank && !currentPiggyBank.is_archived && (
        <View className="px-6 pb-8">
          {/* Add Money Button */}
          <TouchableOpacity
            onPress={() => setShowAddMoneyModal(true)}
            className="bg-primary-500 rounded-2xl py-5 items-center shadow-lg mb-4"
            activeOpacity={0.8}
          >
            <Text className="text-white text-xl font-bold">Add Money</Text>
          </TouchableOpacity>

          {/* Statistics */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
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

      {/* Modals */}
      <AddMoneyModal
        visible={showAddMoneyModal}
        onClose={() => setShowAddMoneyModal(false)}
        piggyBank={currentPiggyBank}
      />

      <CreateGoalModal
        visible={showCreateGoalModal}
        onClose={() => setShowCreateGoalModal(false)}
        onGoalCreated={handleGoalCreated}
      />
    </SafeAreaView>
  );
}
