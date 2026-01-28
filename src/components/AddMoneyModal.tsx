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
} from 'react-native';
import { X } from 'lucide-react-native';
import { usePiggyBankStore } from '@/src/hooks/usePiggyBankStore';
import { PiggyBank } from '@/src/lib/database.types';

interface AddMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  piggyBank: PiggyBank | null;
}

export default function AddMoneyModal({
  visible,
  onClose,
  piggyBank,
}: AddMoneyModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const { addTransaction, getCurrentPiggyBank } = usePiggyBankStore();

  const handleAddMoney = () => {
    if (!piggyBank) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    addTransaction({
      piggy_bank_id: piggyBank.id,
      amount: numAmount,
      date: new Date().toISOString(),
      note: note.trim() || null,
    });

    // Reset form
    setAmount('');
    setNote('');
    onClose();
  };

  const handleNumberPress = (num: string) => {
    if (num === '.' && amount.includes('.')) return;
    if (num === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
      return;
    }
    setAmount((prev) => prev + num);
  };

  const formatCurrency = (value: string) => {
    if (!value) return '0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: piggyBank?.currency || 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  if (!piggyBank) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl pt-6 pb-8">
            {/* Header */}
            <View className="flex-row justify-between items-center px-6 mb-6">
              <Text className="text-2xl font-bold text-gray-900">Add Money</Text>
              <TouchableOpacity onPress={onClose} className="p-2">
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Amount Display */}
            <View className="px-6 mb-6">
              <Text className="text-gray-500 text-sm mb-2">Amount</Text>
              <View className="bg-gray-50 rounded-2xl p-6 items-center">
                <Text className="text-4xl font-bold text-gray-900">
                  {formatCurrency(amount)}
                </Text>
              </View>
            </View>

            {/* Note Input */}
            <View className="px-6 mb-6">
              <Text className="text-gray-500 text-sm mb-2">Note (optional)</Text>
              <TextInput
                className="bg-gray-50 rounded-2xl px-4 py-4 text-gray-900"
                placeholder="Add a note..."
                placeholderTextColor="#9ca3af"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={100}
              />
            </View>

            {/* Number Pad */}
            <View className="px-6 mb-6">
              <View className="flex-row flex-wrap justify-between">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map(
                  (item, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleNumberPress(item)}
                      className={`w-[30%] aspect-square items-center justify-center rounded-2xl mb-3 ${
                        item === 'backspace'
                          ? 'bg-gray-100'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                      activeOpacity={0.7}
                    >
                      {item === 'backspace' ? (
                        <Text className="text-gray-700 text-xl font-semibold">⌫</Text>
                      ) : (
                        <Text className="text-gray-900 text-2xl font-semibold">{item}</Text>
                      )}
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            {/* Add Button */}
            <View className="px-6">
              <TouchableOpacity
                onPress={handleAddMoney}
                className="bg-primary-500 rounded-2xl py-5 items-center"
                activeOpacity={0.8}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                <Text className="text-white text-lg font-bold">Add Money</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
