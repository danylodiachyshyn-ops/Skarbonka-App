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
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import {
  MessageCircle,
  BarChart3,
  Plus,
  Minus,
  Settings,
  Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { useLanguageContext } from '@/src/contexts/LanguageContext';
import { useHomeCurrency } from '@/src/hooks/useHomeCurrency';
import { useExchangeRates } from '@/src/hooks/useExchangeRates';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';
import AddMoneyModal from '@/src/components/AddMoneyModal';
import CreateGoalModal from '@/src/components/CreateGoalModal';
import SettingsModal from '@/src/components/SettingsModal';
import StatisticsModal from '@/src/components/StatisticsModal';
import { UserBox } from '@/src/lib/database.types';
import { Transaction } from '@/src/lib/database.types';
import { formatTransactionDate } from '@/src/lib/dateFormat';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING_H = 16;
const CARD_WIDTH = SCREEN_WIDTH - PADDING_H * 2;
const HEADER_ESTIMATE = 96;
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@skarbonka.app';

const PIGGY_IMAGE: ImageSourcePropType = require('../../assets/piggy-bank.png');

const ACTION_BUTTON_KEYS = [
  { key: 'add', labelKey: 'home.addMoney', Icon: Plus },
  { key: 'stats', labelKey: 'home.statistics', Icon: BarChart3 },
  { key: 'settings', labelKey: 'home.settings', Icon: Settings },
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
  const { t } = useLanguageContext();
  return (
    <Animated.View style={[animatedStyle, { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.3)' }]}>
      <Text className="text-white text-center text-base font-bold" style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
        {t('home.tapToBreakJar')}
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

function getCurrencySymbol(code: string | null | undefined): string {
  const c = (code ?? 'EUR').toUpperCase();
  if (c === 'EUR') return '€';
  if (c === 'USD') return '$';
  if (c === 'UAH') return '₴';
  if (c === 'GBP') return '£';
  return c;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { userBoxes, fetchUserBoxes, loading, getTransactionsForBox, getBalanceOverTimeForBox, deleteUserBox, deleteTransaction } = useBoxStore();
  const { getColorForBox, removeColorForBox } = useJarColor();
  const { homeCurrency } = useHomeCurrency();
  const { convertToHome } = useExchangeRates(homeCurrency);
  const { t, language } = useLanguageContext();

  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showCreateGoalModal, setShowCreateGoalModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const activeBoxes = userBoxes.filter((b) => !b.is_archived);
  const displayItems: DisplayItem[] = [...activeBoxes, { id: 'add_new', isAddNew: true }];

  const currentBox: UserBox | null =
    carouselIndex < activeBoxes.length ? activeBoxes[carouselIndex] ?? null : null;

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

  const screenHeight = Dimensions.get('window').height;
  const slideHeight = screenHeight - HEADER_ESTIMATE - Math.max(insets.bottom, 16) - 24;

  const handleAction = useCallback((key: string) => {
    if (key === 'add') setShowAddMoneyModal(true);
    if (key === 'settings') setShowSettingsModal(true);
    if (key === 'stats') setShowStatsModal(true);
  }, []);

  const openSupport = useCallback(() => {
    const subject = encodeURIComponent('Skarbonka Support');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t('common.error'), t('home.couldNotOpenEmail'));
    });
  }, [t]);

  const handleBreakJar = useCallback(
    (boxId: string) => {
      Alert.alert(
        t('home.breakTheJar'),
        t('home.breakTheJarConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('home.break'),
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
    [activeBoxes, deleteUserBox, fetchUserBoxes, removeColorForBox, t]
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
          <View style={{ width: CARD_WIDTH, height: slideHeight }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: PADDING_H, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
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
                  <Text className="text-white text-xl font-semibold">{t('home.newPiggyBank')}</Text>
                  <Text className="text-white/70 text-sm mt-2">{t('home.swipeRightToAdd')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              <View className="flex-row justify-around py-4">
                {ACTION_BUTTON_KEYS.map(({ key, labelKey, Icon }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleAction(key)}
                    className="items-center"
                    activeOpacity={0.7}
                  >
                    <View className="w-14 h-14 rounded-3xl bg-white/20 items-center justify-center">
                      <Icon size={26} color="#fff" strokeWidth={2} />
                    </View>
                    <Text className="text-white/90 text-xs mt-2 font-medium">{t(labelKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
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
      const currencySym = getCurrencySymbol(box.currency);

      return (
        <View style={{ width: CARD_WIDTH, height: slideHeight }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: PADDING_H, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
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
                    {`${boxBalance}${currencySym}`}
                  </Text>
                  {homeCurrency && (box.currency ?? 'EUR') !== homeCurrency && (() => {
                    const equiv = convertToHome(boxBalance, box.currency ?? null);
                    if (equiv == null) return null;
                    return (
                      <Text className="text-white/80 text-sm mt-1">
                        ≈ {equiv.toFixed(2)}{getCurrencySymbol(homeCurrency)}
                      </Text>
                    );
                  })()}
                  {boxTarget > 0 && (
                    <View className="w-full px-4 mt-3">
                      <View className="h-2 bg-white/30 rounded-full overflow-hidden">
                        <View
                          className="h-full rounded-full bg-white"
                          style={{ width: `${boxProgress * 100}%` }}
                        />
                      </View>
                      <Text className="text-white/80 text-xs mt-1.5 text-center">
                        {boxBalance}{currencySym} {t('home.of')} {Number(boxTarget)}{currencySym}
                      </Text>
                    </View>
                  )}
                  {/* Mini chart: balance over last 7 days */}
                  {(() => {
                    const chartData = getBalanceOverTimeForBox(box.id, 'week');
                    if (chartData.length < 2) return null;
                    const maxBal = Math.max(...chartData.map((d) => d.balance), 1);
                    const chartHeight = 20;
                    return (
                      <View className="w-full px-2 mt-3 flex-row items-end justify-between" style={{ height: chartHeight }}>
                        {chartData.map((d, i) => (
                          <View
                            key={d.date}
                            className="flex-1 rounded-sm mx-0.5 bg-white/50"
                            style={{
                              height: maxBal > 0 ? Math.max(2, (d.balance / maxBal) * chartHeight) : 2,
                            }}
                          />
                        ))}
                      </View>
                    );
                  })()}
                  {isFull && <BreakJarCta />}
                  {!(boxTarget > 0) && (
                    <View className="mt-2 rounded-full px-5 py-2 bg-white/20">
                      <Text className="text-white font-medium">{t('home.bills')}</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <View className="flex-row justify-around py-4">
              {ACTION_BUTTON_KEYS.map(({ key, labelKey, Icon }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleAction(key)}
                  className="items-center"
                  activeOpacity={0.7}
                >
                  <View
                    className="w-14 h-14 rounded-3xl bg-white/20 items-center justify-center"
                    style={
                      key === 'add'
                        ? { backgroundColor: colors.button }
                        : undefined
                    }
                  >
                    <Icon size={26} color="#fff" strokeWidth={2} />
                  </View>
                  <Text className="text-white/90 text-xs mt-2 font-medium">{t(labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="mt-0">
              <Text className="text-white/90 font-semibold text-lg mb-3">{t('home.recentActivity')}</Text>
              <LinearGradient
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.15)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ borderRadius: 24, overflow: 'hidden' }}
              >
                {getTransactionsForBox(box.id).length === 0 ? (
                  <View className="p-6 items-center">
                    <Text className="text-white/90">{t('home.noTransactions')}</Text>
                    <Text className="text-white/70 text-sm mt-1">{t('home.addMoneyToSeeActivity')}</Text>
                  </View>
                ) : (
                  getTransactionsForBox(box.id)
                    .slice(0, 10)
                    .map((tx) => (
                      <Swipeable
                        key={tx.id}
                        friction={2}
                        rightThreshold={80}
                        renderRightActions={(_, __, swipeable) => (
                          <View className="flex-row" style={{ width: 88 }}>
                            <RectButton
                              style={{
                                flex: 1,
                                backgroundColor: '#dc2626',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                              onPress={() => {
                                swipeable.close();
                                Alert.alert(
                                  t('home.deleteTransaction'),
                                  t('home.areYouSureDeleteTransaction'),
                                  [
                                    { text: t('common.cancel'), style: 'cancel' },
                                    {
                                      text: t('common.delete'),
                                      style: 'destructive',
                                      onPress: () => deleteTransaction(tx.id),
                                    },
                                  ]
                                );
                              }}
                            >
                              <Trash2 size={22} color="#fff" strokeWidth={2} />
                              <Text className="text-white text-xs font-medium mt-1">{t('common.delete')}</Text>
                            </RectButton>
                          </View>
                        )}
                      >
                        <View className="flex-row items-center px-5 py-4 border-b border-white/20">
                          <View
                            className="w-10 h-10 rounded-xl items-center justify-center"
                            style={{ backgroundColor: Number(tx.amount) < 0 ? 'rgba(254,226,226,0.9)' : 'rgba(239,246,255,0.9)' }}
                          >
                            {Number(tx.amount) < 0 ? (
                              <Minus size={20} color="#dc2626" strokeWidth={2} />
                            ) : (
                              <Plus size={20} color="#1F96D3" strokeWidth={2} />
                            )}
                          </View>
                          <View className="flex-1 ml-4">
                            <Text className="text-white font-medium">
                              {tx.note || (Number(tx.amount) < 0 ? t('home.withdrawal') : t('home.deposit'))}
                            </Text>
                            <Text className="text-white/80 text-sm mt-0.5">
                              {formatTransactionDate(tx.date, language, { todayLabel: t('home.today') })}
                            </Text>
                          </View>
                          <Text
                            className={
                              Number(tx.amount) < 0 ? 'text-red-200 font-semibold' : 'text-emerald-200 font-semibold'
                            }
                          >
                            {Number(tx.amount) < 0 ? '−' : '+'}
                            {Math.abs(Number(tx.amount)).toFixed(2)} {currencySym}
                          </Text>
                        </View>
                      </Swipeable>
                    ))
                )}
              </LinearGradient>
            </View>
          </ScrollView>
        </View>
      );
    },
    [slideHeight, getColorForBox, handleBreakJar, getTransactionsForBox, getBalanceOverTimeForBox, deleteTransaction, handleAction, homeCurrency, convertToHome, t, language]
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
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header: Profile left, Support right */}
            <View className="flex-row items-center justify-between px-4 pt-2 pb-3">
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
                activeOpacity={0.8}
                onPress={() => router.push('/profile')}
              >
                <Text className="text-white font-semibold text-sm">{initials}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openSupport}
                className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
                activeOpacity={0.8}
              >
                <MessageCircle size={22} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Swipeable centerpiece: each slide = piggy card + its Recent Activity */}
            <View className="mt-2" style={{ height: slideHeight }}>
              {loading && userBoxes.length === 0 ? (
                <View className="min-h-[220px] items-center justify-center px-4">
                  <Text className="text-white/70">{t('home.loading')}</Text>
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

            {userBoxes.length === 0 && !loading && (
              <TouchableOpacity
                onPress={() => setShowCreateGoalModal(true)}
                className="mx-4 mt-4 py-3 rounded-3xl bg-white/20 items-center"
                activeOpacity={0.8}
              >
                <Text className="text-white font-medium">{t('home.createFirstGoal')}</Text>
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
      <StatisticsModal
        visible={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        currentBox={currentBox}
      />
    </View>
  );
}
