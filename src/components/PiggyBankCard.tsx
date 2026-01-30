import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { UserBox } from '@/src/lib/database.types';
import { DEFAULT_PIGGY_BANK_COLOR } from '@/src/lib/colors';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

interface PiggyBankCardProps {
  userBox: UserBox;
  index: number;
  currentIndex: number;
  /** From box_templates when template_id is set; used for progress bar */
  targetAmount?: number | null;
  /** Display currency (e.g. from template or default) */
  currency?: string;
  /** Card background color */
  colorTheme?: string;
  /** Called when user taps close; if provided, shows close button */
  onClose?: (boxId: string) => void;
}

export default function PiggyBankCard({
  userBox,
  index,
  currentIndex,
  targetAmount = null,
  currency = 'PLN',
  colorTheme,
  onClose,
}: PiggyBankCardProps) {
  const current = Number(userBox.current_amount);
  const target = targetAmount ?? 0;
  const progress = target > 0 ? current / target : 0;
  const progressPercentage = Math.min(progress * 100, 100);
  const bgColor = colorTheme ?? DEFAULT_PIGGY_BANK_COLOR;

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleClosePress = () => {
    if (!onClose) return;
    const boxId = userBox.id;
    Alert.alert(
      'Close goal?',
      'This goal will be archived. You can still see it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close goal', style: 'destructive', onPress: () => onClose(boxId) },
      ]
    );
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
          backgroundColor: bgColor,
        }}
      >
        <View className="flex-1 p-8 justify-between">
          <View>
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-white/80 text-sm font-medium mb-2">
                  {userBox.is_archived ? 'Archived' : 'Active Goal'}
                </Text>
                <Text className="text-white text-3xl font-bold mb-6">
                  {userBox.name}
                </Text>
              </View>
              {!userBox.is_archived && onClose && (
                <TouchableOpacity
                  onPress={handleClosePress}
                  style={{ padding: 12, margin: -12, zIndex: 10 }}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  activeOpacity={0.7}
                >
                  <X size={24} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="mb-6">
            {target > 0 && (
              <View className="h-3 bg-white/20 rounded-full mb-4 overflow-hidden">
                <View
                  className="h-full bg-white rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </View>
            )}

            <View className="flex-row justify-between items-baseline">
              <View>
                <Text className="text-white/70 text-sm mb-1">Current</Text>
                <Text className="text-white text-2xl font-bold">
                  {formatCurrency(current)}
                </Text>
              </View>
              {target > 0 && (
                <View className="items-end">
                  <Text className="text-white/70 text-sm mb-1">Target</Text>
                  <Text className="text-white text-2xl font-bold">
                    {formatCurrency(target)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="items-center">
            {target > 0 ? (
              <>
                <Text className="text-white/90 text-4xl font-bold">
                  {Math.round(progressPercentage)}%
                </Text>
                <Text className="text-white/70 text-sm mt-1">Complete</Text>
              </>
            ) : (
              <Text className="text-white/70 text-sm">No target set</Text>
            )}
          </View>
        </View>

        <View
          className="absolute inset-0 opacity-10"
          style={{
            backgroundColor: 'transparent',
          }}
        />
      </View>
    </Animated.View>
  );
}
