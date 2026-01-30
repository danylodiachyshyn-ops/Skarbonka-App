import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageSourcePropType,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  MessageCircle,
  BarChart3,
  Plus,
  Settings,
} from 'lucide-react-native';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';
import AddMoneyModal from '@/src/components/AddMoneyModal';
import CreateGoalModal from '@/src/components/CreateGoalModal';
import SettingsModal from '@/src/components/SettingsModal';
import { UserBox } from '@/src/lib/database.types';
import { Transaction } from '@/src/lib/database.types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING_H = 16;
const CARD_WIDTH = SCREEN_WIDTH - PADDING_H * 2;

const PIGGY_IMAGE: ImageSourcePropType = require('../../assets/piggy-bank.png');

const ACTION_BUTTONS = [
  { key: 'add', label: 'Add money', Icon: Plus },
  { key: 'stats', label: 'Statistics', Icon: BarChart3 },
  { key: 'settings', label: 'Settings', Icon: Settings },
] as const;

type DisplayItem =
  | { id: string; isAddNew: true }
  | (UserBox & { isAddNew?: false });

function BreakJarCta() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    return () => {
      scale.value = withTiming(1);
    };
  }, [scale]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={[animatedStyle, { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.3)' }]}>
      <Text className="text-white text-center text-base font-bold" style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
        Tap to break the jar!
      </Text>
    </Animated.View>
  );
}

function ShakingPiggy({ isFull, children }: { isFull: boolean; children: React.ReactNode }) {
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!isFull) return;
    shake.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 80, easing: Easing.inOut(Easing.ease) }),
        withTiming(3, { duration: 80, easing: Easing.inOut(Easing.ease) }),
        withTiming(-2, { duration: 60, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 60, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 60 })
      ),
      -1,
      true
    );
    return () => {
      shake.value = withTiming(0);
    };
  }, [isFull, shake]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

function formatTransactionDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Today, ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { userBoxes, fetchUserBoxes, loading, getTransactionsForBox, deleteUserBox } = useBoxStore();
  const { getColorForBox, removeColorForBox } = useJarColor();

  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const activeBoxes = userBoxes.filter((b) => !b.is_archived);
  const displayItems: DisplayItem[] = [...activeBoxes, { id: 'add_new', isAddNew: true }];

  const currentBox: UserBox | null =
    carouselIndex < activeBoxes.length ? activeBoxes[carouselIndex] ?? null : null;
  const recentTransactions: Transaction[] = currentBox
    ? getTransactionsForBox(currentBox.id)
    : [];

  useEffect(() => {
    if (user?.id) {
      fetchUserBoxes();
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeBoxes.length > 0 && carouselIndex >= displayItems.length) {
      setCarouselIndex(displayItems.length - 1);
    }
  }, [userBoxes.length]);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'U';

  const handleAction = useCallback((key: string) => {
    if (key === 'add') setShowAddMoneyModal(true);
    if (key === 'settings') setShowSettingsModal(true);
  }, []);

  const handleBreakJar = useCallback(
    (boxId: string) => {
      Alert.alert(
        'Break the jar?',
        'The jar and its transaction history will be removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Break',
            style: 'destructive',
            onPress: async () => {
              const idx = activeBoxes.findIndex((b) => b.id === boxId);
              await deleteUserBox(boxId);
              await removeColorForBox(boxId);
              await fetchUserBoxes();
              const newCount = activeBoxes.length - 1;
              setCarouselIndex(Math.min(idx, Math.max(0, newCount - 1)));
            },
          },
        ]
      );
    },
    [activeBoxes, deleteUserBox, fetchUserBoxes, removeColorForBox]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const index = Math.round((x - PADDING_H) / CARD_WIDTH);
      setCarouselIndex(Math.min(Math.max(0, index), displayItems.length - 1));
    },
    [displayItems.length]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: CARD_WIDTH,
      offset: PADDING_H + CARD_WIDTH * index,
      index,
    }),
    []
  );

  const renderCenterpiecePage = useCallback(
    ({ item, index }: { item: DisplayItem; index: number }) => {
      const isAddNew = (item as { isAddNew?: boolean }).isAddNew === true;

      if (isAddNew) {
        return (
          <View style={{ width: CARD_WIDTH, paddingHorizontal: PADDING_H }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setShowCreateGoalModal(true)}
              className="rounded-3xl overflow-hidden min-h-[220px]"
              style={{
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: 'rgba(255,255,255,0.4)',
              }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  borderRadius: 24,
                  minHeight: 220,
                  paddingVertical: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center mb-4">
                  <Plus size={40} color="#fff" strokeWidth={2} />
                </View>
                <Text className="text-white text-xl font-semibold">New piggy bank</Text>
                <Text className="text-white/70 text-sm mt-2">Swipe right to add a goal</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        );
      }

      const box = item as UserBox & {
        target_amount?: number | null;
        box_templates?: { total_amount?: number; currency?: string } | null;
      };
      const boxBalance = Number(box.current_amount);
      const boxTarget = box.target_amount ?? box.box_templates?.total_amount ?? 0;
      const boxProgress = boxTarget > 0 ? Math.min(boxBalance / Number(boxTarget), 1) : 0;
      const isFull = boxTarget > 0 && boxBalance >= Number(boxTarget);
      const preset: JarColorPreset = getColorForBox(box.id);
      const colors = JAR_COLOR_PRESETS[preset];

      return (
        <View style={{ width: CARD_WIDTH, paddingHorizontal: PADDING_H }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => isFull && handleBreakJar(box.id)}
            className="rounded-3xl overflow-hidden min-h-[220px]"
            style={{
              shadowColor: isFull ? colors.button : '#000',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isFull ? 0.5 : 0.15,
              shadowRadius: isFull ? 20 : 8,
              elevation: isFull ? 12 : 4,
            }}
          >
            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                minHeight: 220,
                paddingBottom: 24,
                paddingHorizontal: 20,
              }}
            >
              <View className="items-center pt-4 pb-2">
                <ShakingPiggy isFull={!!isFull}>
                  <Image
                    source={PIGGY_IMAGE}
                    resizeMode="contain"
                    className="w-28 h-28 rounded-2xl"
                    style={{ opacity: 0.95 }}
                  />
                </ShakingPiggy>
                <Text className="text-white/90 text-lg font-semibold mt-2" numberOfLines={1}>
                  {box.name}
                </Text>
                <Text className="text-white text-4xl font-bold mt-1">
                  {`${boxBalance}€`}
                </Text>
                {boxTarget > 0 && (
                  <View className="w-full px-4 mt-3">
                    <View className="h-2 bg-white/30 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full bg-white"
                        style={{ width: `${boxProgress * 100}%` }}
                      />
                    </View>
                    <Text className="text-white/80 text-xs mt-1.5 text-center">
                      {boxBalance}€ of {Number(boxTarget)}€
                    </Text>
                  </View>
                )}
                {isFull && <BreakJarCta />}
                {!(boxTarget > 0) && (
                  <View className="mt-2 rounded-full px-5 py-2 bg-white/20">
                    <Text className="text-white font-medium">Bills</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    },
    [getColorForBox, handleBreakJar]
  );

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#0f172a', '#1e3a5f', '#1e40af']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1" edges={['top']}>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 108 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header: Profile left, Support right */}
            <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
                activeOpacity={0.8}
              >
                <Text className="text-white font-semibold text-sm">{initials}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
                activeOpacity={0.8}
              >
                <MessageCircle size={22} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Swipeable centerpiece */}
            <View className="mt-2">
              {loading && userBoxes.length === 0 ? (
                <View className="min-h-[220px] items-center justify-center px-4">
                  <Text className="text-white/70">Loading…</Text>
                </View>
              ) : (
                <FlatList
                  data={displayItems}
                  keyExtractor={(item) => (item as { id: string }).id}
                  renderItem={renderCenterpiecePage}
                  getItemLayout={getItemLayout}
                  horizontal
                  pagingEnabled
                  snapToInterval={CARD_WIDTH}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onMomentumScrollEnd}
                  contentContainerStyle={{ paddingLeft: PADDING_H, paddingRight: PADDING_H }}
                />
              )}
            </View>

            {/* 3 action buttons */}
            <View className="flex-row justify-around px-6 py-6">
              {ACTION_BUTTONS.map(({ key, label, Icon }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleAction(key)}
                  className="items-center"
                  activeOpacity={0.7}
                >
                  <View
                    className="w-14 h-14 rounded-3xl bg-white/20 items-center justify-center"
                    style={
                      key === 'add' && currentBox
                        ? {
                            backgroundColor: JAR_COLOR_PRESETS[getColorForBox(currentBox.id)].button,
                          }
                        : undefined
                    }
                  >
                    <Icon size={26} color="#fff" strokeWidth={2} />
                  </View>
                  <Text className="text-white/90 text-xs mt-2 font-medium">{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Activity */}
            <View className="px-4 pb-4">
              <Text className="text-white/90 font-semibold text-lg mb-3">Recent Activity</Text>
              <View className="bg-white rounded-3xl overflow-hidden shadow-sm">
                {currentBox ? (
                  recentTransactions.length === 0 ? (
                    <View className="p-6 items-center">
                      <Text className="text-slate-500">No transactions yet</Text>
                      <Text className="text-slate-400 text-sm mt-1">Add money to see activity</Text>
                    </View>
                  ) : (
                    recentTransactions.slice(0, 10).map((tx) => (
                      <View
                        key={tx.id}
                        className="flex-row items-center px-5 py-4 border-b border-slate-100"
                      >
                        <View className="w-10 h-10 rounded-xl bg-primary-50 items-center justify-center">
                          <Plus size={20} color="#1F96D3" strokeWidth={2} />
                        </View>
                        <View className="flex-1 ml-4">
                          <Text className="text-slate-800 font-medium">
                            {tx.note || 'Deposit'}
                          </Text>
                          <Text className="text-slate-400 text-sm mt-0.5">
                            {formatTransactionDate(tx.date)}
                          </Text>
                        </View>
                        <Text className="text-green-600 font-semibold">
                          +{Number(tx.amount).toFixed(2)} €
                        </Text>
                      </View>
                    ))
                  )
                ) : (
                  <View className="p-6 items-center">
                    <Text className="text-slate-500">Select a jar to see activity</Text>
                  </View>
                )}
              </View>
            </View>

            {userBoxes.length === 0 && !loading && (
              <TouchableOpacity
                onPress={() => setShowCreateGoalModal(true)}
                className="mx-4 mt-4 py-3 rounded-3xl bg-white/20 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-white font-medium">Create your first goal</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      <View pointerEvents="box-none" collapsable={false}>
        <AddMoneyModal
          visible={showAddMoneyModal}
          onClose={() => setShowAddMoneyModal(false)}
          userBox={currentBox}
          accentColor={currentBox ? JAR_COLOR_PRESETS[getColorForBox(currentBox.id)].button : undefined}
        />
      </View>

      {showCreateGoalModal && (
        <CreateGoalModal
          visible={showCreateGoalModal}
          onClose={() => setShowCreateGoalModal(false)}
          onGoalCreated={() => {
            setShowCreateGoalModal(false);
            fetchUserBoxes();
          }}
        />
      )}

      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentBox={currentBox}
      />
    </View>
  );
}
