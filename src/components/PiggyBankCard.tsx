import { View, Text } from 'react-native';
import { PiggyBank } from '@/src/lib/database.types';
import { DEFAULT_PIGGY_BANK_COLOR } from '@/src/lib/colors';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface PiggyBankCardProps {
  piggyBank: PiggyBank;
  index: number;
  currentIndex: number;
}

export default function PiggyBankCard({
  piggyBank,
  index,
  currentIndex,
}: PiggyBankCardProps) {
  const progress = Number(piggyBank.current_amount) / Number(piggyBank.target_amount);
  const progressPercentage = Math.min(progress * 100, 100);

  // Animation for card scale and opacity based on position
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index - currentIndex;
    const absOffset = Math.abs(offset);

    return {
      transform: [
        {
          scale: withSpring(
            absOffset === 0 ? 1 : absOffset === 1 ? 0.95 : 0.9,
            { damping: 15, stiffness: 150 }
          ),
        },
        {
          translateX: withSpring(offset * 20, { damping: 15, stiffness: 150 }),
        },
      ],
      opacity: withSpring(absOffset > 1 ? 0.5 : 1, { damping: 15, stiffness: 150 }),
    };
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: piggyBank.currency || 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width: '90%',
          height: '70%',
          alignSelf: 'center',
        },
      ]}
    >
      <View
        className="flex-1 rounded-3xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: piggyBank.color_theme || DEFAULT_PIGGY_BANK_COLOR,
        }}
      >
        {/* Card Content */}
        <View className="flex-1 p-8 justify-between">
          {/* Header */}
          <View>
            <Text className="text-white/80 text-sm font-medium mb-2">
              {piggyBank.is_archived ? 'Archived' : 'Active Goal'}
            </Text>
            <Text className="text-white text-3xl font-bold mb-6">
              {piggyBank.name}
            </Text>
          </View>

          {/* Progress Section */}
          <View className="mb-6">
            {/* Progress Bar */}
            <View className="h-3 bg-white/20 rounded-full mb-4 overflow-hidden">
              <View
                className="h-full bg-white rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </View>

            {/* Amounts */}
            <View className="flex-row justify-between items-baseline">
              <View>
                <Text className="text-white/70 text-sm mb-1">Current</Text>
                <Text className="text-white text-2xl font-bold">
                  {formatCurrency(Number(piggyBank.current_amount))}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-white/70 text-sm mb-1">Target</Text>
                <Text className="text-white text-2xl font-bold">
                  {formatCurrency(Number(piggyBank.target_amount))}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress Percentage */}
          <View className="items-center">
            <Text className="text-white/90 text-4xl font-bold">
              {Math.round(progressPercentage)}%
            </Text>
            <Text className="text-white/70 text-sm mt-1">Complete</Text>
          </View>
        </View>

        {/* Decorative gradient overlay */}
        <View
          className="absolute inset-0 opacity-10"
          style={{
            backgroundColor: `linear-gradient(135deg, ${piggyBank.color_theme} 0%, transparent 100%)`,
          }}
        />
      </View>
    </Animated.View>
  );
}
