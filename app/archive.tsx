import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, Archive, RotateCcw } from 'lucide-react-native';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { useLanguageContext } from '@/src/contexts/LanguageContext';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';
import { UserBox } from '@/src/lib/database.types';
import { Transaction } from '@/src/lib/database.types';
import { formatTransactionDate } from '@/src/lib/dateFormat';

function getCurrencySymbol(code: string | null | undefined): string {
  const c = (code ?? 'EUR').toUpperCase();
  if (c === 'EUR') return '€';
  if (c === 'USD') return '$';
  if (c === 'UAH') return '₴';
  if (c === 'GBP') return '£';
  return c;
}

export default function ArchiveScreen() {
  const router = useRouter();
  const { t, language } = useLanguageContext();
  const { userBoxes, fetchUserBoxes, getTransactionsForBox, unarchiveUserBox, loading } = useBoxStore();
  const { getColorForBox } = useJarColor();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const archivedBoxes = userBoxes.filter((b) => b.is_archived);

  useEffect(() => {
    fetchUserBoxes();
  }, []);

  const handleRestore = (box: UserBox) => {
    Alert.alert(
      t('archive.restoreJar'),
      t('archive.restoreConfirm', { name: box.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.restore'),
          onPress: async () => {
            await unarchiveUserBox(box.id);
            if (archivedBoxes.length <= 1) router.back();
          },
        },
      ]
    );
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
          <View className="flex-row items-center px-4 pt-2 pb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
              activeOpacity={0.8}
            >
              <ChevronLeft size={22} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold ml-3">{t('archive.title')}</Text>
          </View>

          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {loading && userBoxes.length === 0 ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="rgba(255,255,255,0.8)" />
              </View>
            ) : archivedBoxes.length === 0 ? (
              <View className="rounded-2xl bg-white/10 p-8 items-center">
                <Archive size={48} color="rgba(255,255,255,0.5)" strokeWidth={2} />
                <Text className="text-white/80 text-lg font-medium mt-4">{t('archive.noArchivedJars')}</Text>
                <Text className="text-white/60 text-sm mt-2 text-center">
                  {t('archive.archivedDescription')}
                </Text>
              </View>
            ) : (
              archivedBoxes.map((box) => {
                const preset: JarColorPreset = getColorForBox(box.id);
                const colors = JAR_COLOR_PRESETS[preset];
                const currencySym = getCurrencySymbol(box.currency);
                const balance = Number(box.current_amount);
                const transactions = getTransactionsForBox(box.id);
                const isExpanded = expandedId === box.id;

                return (
                  <View
                    key={box.id}
                    className="rounded-2xl overflow-hidden mb-4"
                    style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                  >
                    <TouchableOpacity
                      onPress={() => setExpandedId(isExpanded ? null : box.id)}
                      activeOpacity={0.9}
                      className="p-4 flex-row items-center justify-between"
                    >
                      <View className="flex-1">
                        <Text className="text-white font-semibold text-lg" numberOfLines={1}>
                          {box.name}
                        </Text>
                        <Text className="text-white/80 text-base mt-0.5">
                          {balance.toFixed(2)}{currencySym}
                        </Text>
                      </View>
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: colors.button }}
                      >
                        <Archive size={20} color="#fff" strokeWidth={2} />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View className="px-4 pb-4 pt-0 border-t border-white/20">
                        <Text className="text-white/70 text-sm font-medium mt-3 mb-2">{t('archive.history')}</Text>
                        <View className="rounded-xl overflow-hidden bg-white/10">
                          {transactions.length === 0 ? (
                            <View className="p-4">
                              <Text className="text-white/60 text-sm">{t('archive.noTransactions')}</Text>
                            </View>
                          ) : (
                            transactions.slice(0, 15).map((tx: Transaction) => (
                              <View
                                key={tx.id}
                                className="flex-row items-center justify-between px-4 py-3 border-b border-white/10"
                              >
                                <View className="flex-1">
                                  <Text className="text-white font-medium" numberOfLines={1}>
                                    {tx.note || (Number(tx.amount) < 0 ? t('home.withdrawal') : t('home.deposit'))}
                                  </Text>
                                  <Text className="text-white/50 text-xs mt-0.5">
                                    {formatTransactionDate(tx.date, language)}
                                  </Text>
                                </View>
                                <Text
                                  className={
                                    Number(tx.amount) < 0
                                      ? 'text-red-300 font-semibold'
                                      : 'text-green-300 font-semibold'
                                  }
                                >
                                  {Number(tx.amount) < 0 ? '−' : '+'}
                                  {Math.abs(Number(tx.amount)).toFixed(2)} {currencySym}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleRestore(box)}
                          disabled={loading}
                          className="flex-row items-center justify-center rounded-xl py-3 mt-4 border border-white/30 bg-white/15"
                          activeOpacity={0.8}
                        >
                          {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <RotateCcw size={18} color="#fff" strokeWidth={2} style={{ marginRight: 8 }} />
                              <Text className="text-white font-semibold">{t('archive.restoreToActive')}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
