import { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { UserBox } from '@/src/lib/database.types';

const NUM_COLUMNS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 24;
const GAP = 10;
const BUBBLE_SIZE =
  (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

type UserBoxWithTemplate = UserBox & {
  box_templates?: {
    grid_config: number[];
    currency?: string;
  } | null;
};

interface PiggyBankGridProps {
  userBox: UserBoxWithTemplate;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  PLN: 'zł',
  UAH: '₴',
  EUR: '€',
  USD: '$',
};

export default function PiggyBankGrid({ userBox }: PiggyBankGridProps) {
  const crossOutIndex = useBoxStore((s) => s.crossOutIndex);

  const gridConfig = userBox.box_templates?.grid_config ?? [];
  const currencyCode = userBox.box_templates?.currency ?? 'PLN';
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] ?? 'zł';
  const crossedOut = userBox.crossed_out_indices ?? [];

  const handleBubblePress = useCallback(
    async (index: number) => {
      if (crossedOut.includes(index)) return;
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Haptics not available (e.g. simulator)
      }
      await crossOutIndex(userBox.id, index);
    },
    [userBox.id, crossedOut, crossOutIndex]
  );

  const renderBubble = useCallback(
    ({ item, index }: { item: number; index: number }) => {
      const isCrossedOut = crossedOut.includes(index);

      return (
        <TouchableOpacity
          onPress={() => handleBubblePress(index)}
          disabled={isCrossedOut}
          activeOpacity={0.8}
          style={[
            styles.bubble,
            isCrossedOut ? styles.bubbleCrossedOut : styles.bubbleActive,
          ]}
        >
          {isCrossedOut ? (
            <View style={styles.checkWrapper}>
              <Check size={BUBBLE_SIZE * 0.4} color="#fff" strokeWidth={3} />
            </View>
          ) : (
            <>
              <Text
                style={[styles.amountText, isCrossedOut && styles.amountTextDim]}
                numberOfLines={1}
              >
                {item}
              </Text>
              <Text
                style={[styles.currencyText, isCrossedOut && styles.currencyTextDim]}
                numberOfLines={1}
              >
                {currencySymbol}
              </Text>
            </>
          )}
        </TouchableOpacity>
      );
    },
    [crossedOut, currencySymbol, handleBubblePress]
  );

  if (gridConfig.length === 0) {
    return (
      <View style={styles.emptyWrapper}>
        <Text style={styles.emptyText}>No grid template for this box</Text>
        <Text style={styles.emptySubtext}>
          Create a box from a template to see the phygital grid
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tap to cross out • Phygital grid</Text>
      <FlatList
        data={gridConfig}
        keyExtractor={(_, index) => `grid-${index}`}
        numColumns={NUM_COLUMNS}
        scrollEnabled={false}
        columnWrapperStyle={styles.row}
        renderItem={renderBubble}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: GAP,
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleActive: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1F96D3',
  },
  bubbleCrossedOut: {
    backgroundColor: '#10b981',
    borderWidth: 0,
    opacity: 0.95,
  },
  amountText: {
    fontSize: Math.min(BUBBLE_SIZE * 0.28, 18),
    fontWeight: '700',
    color: '#1f2937',
  },
  amountTextDim: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  currencyText: {
    fontSize: Math.min(BUBBLE_SIZE * 0.2, 12),
    fontWeight: '600',
    color: '#6b7280',
  },
  currencyTextDim: {
    color: '#9ca3af',
  },
  checkWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrapper: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 4,
  },
});
