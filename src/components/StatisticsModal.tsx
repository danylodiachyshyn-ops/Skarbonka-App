import { useState, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line, G } from 'react-native-svg';
import { X } from 'lucide-react-native';
import { useLanguageContext } from '@/src/contexts/LanguageContext';
import { useJarColor, JAR_COLOR_PRESETS } from '@/src/contexts/JarColorContext';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { UserBox } from '@/src/lib/database.types';

const CHART_WIDTH = Dimensions.get('window').width - 48;
const CHART_HEIGHT = 200;
const PADDING_LEFT = 36;
const PADDING_RIGHT = 16;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;
const PLOT_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

type Period = 'week' | 'month' | 'all';

function getCurrencySymbol(code: string | null | undefined): string {
  const c = (code ?? 'EUR').toUpperCase();
  if (c === 'EUR') return '€';
  if (c === 'USD') return '$';
  if (c === 'UAH') return '₴';
  if (c === 'GBP') return '£';
  return c;
}

interface StatisticsModalProps {
  visible: boolean;
  onClose: () => void;
  currentBox: UserBox | null;
}

function buildPath(
  data: { label: string; balance: number; date: string }[],
  maxBalance: number
): string {
  if (data.length === 0) return '';
  if (data.length === 1) {
    const x = PADDING_LEFT + PLOT_WIDTH / 2;
    const y = PADDING_TOP + PLOT_HEIGHT * (1 - data[0].balance / maxBalance);
    return `M ${x} ${y} L ${x} ${y}`;
  }
  const points = data.map((d, i) => {
    const x = PADDING_LEFT + (i / (data.length - 1)) * PLOT_WIDTH;
    const y = PADDING_TOP + PLOT_HEIGHT * (1 - d.balance / maxBalance);
    return { x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return path;
}

function buildAreaPath(
  data: { label: string; balance: number; date: string }[],
  maxBalance: number
): string {
  const linePath = buildPath(data, maxBalance);
  if (!linePath || data.length === 0) return '';
  const xLast = PADDING_LEFT + ((data.length - 1) / Math.max(data.length - 1, 1)) * PLOT_WIDTH;
  const xFirst = PADDING_LEFT;
  const yBottom = PADDING_TOP + PLOT_HEIGHT;
  return `${linePath} L ${xLast} ${yBottom} L ${xFirst} ${yBottom} Z`;
}

export default function StatisticsModal({
  visible,
  onClose,
  currentBox,
}: StatisticsModalProps) {
  const { t } = useLanguageContext();
  const { getColorForBox } = useJarColor();
  const { getBalanceOverTimeForBox } = useBoxStore();
  const [period, setPeriod] = useState<Period>('week');

  const chartData = currentBox
    ? getBalanceOverTimeForBox(currentBox.id, period)
    : [];
  const targetAmount = currentBox?.target_amount != null ? Number(currentBox.target_amount) : null;
  const hasTarget = targetAmount != null && targetAmount > 0;
  const maxBalance = useMemo(() => {
    const dataMax = Math.max(...chartData.map((d) => d.balance), 0);
    if (hasTarget && targetAmount != null) return Math.max(targetAmount, dataMax);
    return Math.ceil(Math.max(dataMax, 1) * 1.1) || 1;
  }, [chartData, hasTarget, targetAmount]);

  const preset = currentBox ? getColorForBox(currentBox.id) : 'ocean';
  const colors = JAR_COLOR_PRESETS[preset];
  const currencySym = getCurrencySymbol(currentBox?.currency);
  const linePath = buildPath(chartData, maxBalance);
  const areaPath = buildAreaPath(chartData, maxBalance);

  const showLabels = (n: number) => {
    if (chartData.length <= n) return chartData.map((d) => d.label);
    const step = Math.ceil(chartData.length / n);
    return chartData.map((d, i) => (i % step === 0 ? d.label : ''));
  };
  const xLabels = period === 'week' ? showLabels(7) : period === 'month' ? showLabels(6) : showLabels(5);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl pt-6 pb-8 px-6">
          <SafeAreaView edges={['top']}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-slate-800 text-2xl font-bold">{t('statistics.title')}</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
              >
                <X size={22} color="#475569" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {currentBox ? (
              <>
                <Text className="text-slate-600 font-medium mb-3">{currentBox.name}</Text>

                <View className="flex-row rounded-xl bg-slate-100 p-1 mb-4">
                  {(['week', 'month', 'all'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPeriod(p)}
                      className="flex-1 py-2 rounded-lg"
                      style={{
                        backgroundColor: period === p ? '#fff' : 'transparent',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.06,
                        shadowRadius: 2,
                        elevation: 2,
                      }}
                    >
                      <Text
                        className="text-center font-semibold text-sm"
                        style={{ color: period === p ? '#0f172a' : '#64748b' }}
                      >
                        {p === 'week' ? t('statistics.week') : p === 'month' ? t('statistics.month') : t('statistics.allTime')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View className="rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
                  {chartData.length === 0 ? (
                    <View style={{ height: CHART_HEIGHT + 32 }} className="items-center justify-center px-4">
                      <Text className="text-slate-500 text-center">
                        {t('statistics.noActivityInPeriod')}{'\n'}{t('statistics.addMoneyToSeeProgress')}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View className="px-2 pt-2">
                        <Text className="text-slate-500 text-xs">
                          {t('statistics.balance')} ({currencySym}) — {t('statistics.to')} {maxBalance}{currencySym}
                          {hasTarget && targetAmount != null ? ` (${t('statistics.goal')}: ${targetAmount}${currencySym})` : ''}
                        </Text>
                      </View>
                      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                        <G>
                          {hasTarget && targetAmount != null && targetAmount <= maxBalance ? (
                            <Line
                              x1={PADDING_LEFT}
                              y1={PADDING_TOP + PLOT_HEIGHT * (1 - targetAmount / maxBalance)}
                              x2={PADDING_LEFT + PLOT_WIDTH}
                              y2={PADDING_TOP + PLOT_HEIGHT * (1 - targetAmount / maxBalance)}
                              stroke="#64748b"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                            />
                          ) : null}
                          {areaPath ? (
                            <Path
                              d={areaPath}
                              fill={colors.button}
                              fillOpacity={0.2}
                            />
                          ) : null}
                          {linePath ? (
                            <Path
                              d={linePath}
                              stroke={colors.button}
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          ) : null}
                          <Line
                            x1={PADDING_LEFT}
                            y1={PADDING_TOP}
                            x2={PADDING_LEFT}
                            y2={PADDING_TOP + PLOT_HEIGHT}
                            stroke="#e2e8f0"
                            strokeWidth={1}
                          />
                          <Line
                            x1={PADDING_LEFT}
                            y1={PADDING_TOP + PLOT_HEIGHT}
                            x2={PADDING_LEFT + PLOT_WIDTH}
                            y2={PADDING_TOP + PLOT_HEIGHT}
                            stroke="#e2e8f0"
                            strokeWidth={1}
                          />
                        </G>
                      </Svg>
                      <View className="flex-row px-1 pb-2" style={{ marginLeft: PADDING_LEFT - 4, width: PLOT_WIDTH + 8 }}>
                        {xLabels.map((label, i) => (
                          <View
                            key={i}
                            style={{
                              width: `${100 / xLabels.length}%`,
                              alignItems: 'center',
                            }}
                          >
                            <Text className="text-slate-400 text-xs" numberOfLines={1}>
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>

                {chartData.length > 0 && (
                  <View className="mt-3 flex-row justify-between">
                    <Text className="text-slate-500 text-sm">{t('statistics.start')}</Text>
                    <Text className="text-slate-800 font-semibold">
                      {t('statistics.current')}: {Number(currentBox.current_amount).toFixed(2)} {currencySym}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={{ minHeight: 180 }} className="items-center justify-center">
                <Text className="text-slate-500">{t('statistics.selectPiggyBankForStats')}</Text>
              </View>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
