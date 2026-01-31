import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.82, 640);
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { UserBox } from '@/src/lib/database.types';

interface AddMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  userBox: UserBox | null;
  accentColor?: string;
}

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
] as const;

export default function AddMoneyModal({
  visible,
  onClose,
  userBox,
  accentColor = '#1F96D3',
}: AddMoneyModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();
  const { addTransaction } = useBoxStore();

  const handleAddMoney = async () => {
    if (!userBox) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTransaction(userBox.id, numAmount, note.trim() || null);
      setAmount('');
      setNote('');
      onClose();
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumberPress = (num: string) => {
    if (num === '.' && amount.includes('.')) return;
    if (num === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    setAmount((prev) => prev + num);
  };

  const currencyCode = (userBox?.currency ?? 'EUR').toUpperCase();
  const formatCurrency = (value: string) => {
    if (!value) return '0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#f8fafc',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingBottom: Platform.OS === 'ios' ? 34 : 24,
              height: PANEL_HEIGHT,
            }}
          >
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
              <View
                className="flex-row justify-between items-center px-5 pb-2"
                style={{ paddingTop: Math.max(insets.top, 16) }}
              >
                <Text className="text-slate-800 text-2xl font-bold">Add Money</Text>
                <TouchableOpacity
                  onPress={() => onClose()}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
                  activeOpacity={0.8}
                >
                  <X size={22} color="#475569" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
              {!userBox ? (
                <View className="flex-1 items-center justify-center px-5">
                  <Text className="text-slate-500 text-center">Select a jar to add money.</Text>
                </View>
              ) : (
                <>
                  <View className="px-5 mb-4">
                    <Text className="text-slate-500 text-sm mb-2">Amount</Text>
                    <View className="bg-white rounded-3xl p-6 items-center shadow-sm">
                      <Text className="text-slate-800 text-4xl font-bold">
                        {formatCurrency(amount)}
                      </Text>
                    </View>
                  </View>

                  <View className="px-5 mb-4">
                    <Text className="text-slate-500 text-sm mb-2">Note (optional)</Text>
                    <TextInput
                      className="bg-white rounded-2xl px-4 py-3 text-slate-800 text-base shadow-sm"
                      placeholder="Add a note…"
                      placeholderTextColor="#94a3b8"
                      value={note}
                      onChangeText={setNote}
                      maxLength={100}
                    />
                  </View>

                  <View className="px-5 mb-5">
                    {KEYPAD_ROWS.map((row, rowIndex) => (
                  <View
                    key={rowIndex}
                    className="flex-row justify-between mb-3"
                    style={{ gap: 12 }}
                  >
                    {row.map((item) => (
                      <TouchableOpacity
                        key={item}
                        onPress={() => handleNumberPress(item)}
                        activeOpacity={0.7}
                        className="flex-1 h-14 rounded-3xl items-center justify-center bg-white shadow-sm"
                        style={{
                          maxWidth: row.length === 3 ? '31%' : undefined,
                        }}
                      >
                        {item === 'backspace' ? (
                          <Text className="text-slate-600 text-xl font-semibold">⌫</Text>
                        ) : (
                          <Text className="text-slate-800 text-2xl font-semibold">{item}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                    ))}
                  </View>

                  <View className="px-5">
                    <TouchableOpacity
                      onPress={handleAddMoney}
                      className="rounded-3xl py-5 items-center"
                      style={{ backgroundColor: accentColor }}
                      activeOpacity={0.8}
                      disabled={!amount || parseFloat(amount) <= 0 || isSubmitting}
                    >
                      <Text className="text-white text-lg font-bold">
                        {isSubmitting ? 'Adding…' : 'Add Money'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              </View>
            </SafeAreaView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
