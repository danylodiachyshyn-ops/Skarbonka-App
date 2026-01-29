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
  ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { DEFAULT_PIGGY_BANK_COLOR } from '@/src/lib/colors';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onGoalCreated?: () => void;
}

type ColorTheme = { name: string; value: string };

const COLOR_THEMES: ColorTheme[] = [
  { name: 'Brand Blue', value: '#1F96D3' }, // Deep blue (main brand color)
  { name: 'Light Blue', value: '#33A8E8' }, // Light blue (top gradient)
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
];

export default function CreateGoalModal({
  visible,
  onClose,
  onGoalCreated,
}: CreateGoalModalProps) {
  // Prevent rendering when hidden (avoids runtime crashes inside Modal subtree)
  if (!visible) return null;

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_PIGGY_BANK_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();
  const { createUserBox } = useBoxStore();

  const handleSelectColor = (value: string) => {
    setSelectedColor(value);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a goal name');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a goal');
      return;
    }

    const target = targetAmount.trim() ? parseFloat(targetAmount) : null;
    if (targetAmount.trim() && (isNaN(target!) || target! <= 0)) {
      Alert.alert('Error', 'Please enter a valid target amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await createUserBox(name.trim(), target ?? undefined);

      // Reset form
      setName('');
      setTargetAmount('');
      setSelectedColor(DEFAULT_PIGGY_BANK_COLOR);
      onClose();
      onGoalCreated?.();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create goal');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <View className="bg-white rounded-t-3xl pt-6 pb-8 max-h-[90%]">
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View className="flex-row justify-between items-center px-6 mb-6">
                <Text className="text-2xl font-bold text-gray-900">Create New Goal</Text>
                <TouchableOpacity onPress={onClose} className="p-2">
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {/* Goal Name */}
              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-2">Goal Name</Text>
                <TextInput
                  className="bg-gray-50 rounded-2xl px-4 py-4 text-gray-900 text-base"
                  placeholder="e.g., Vacation, New Laptop"
                  placeholderTextColor="#9ca3af"
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                />
              </View>

              {/* Target Amount */}
              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-2">Target Amount</Text>
                <TextInput
                  className="bg-gray-50 rounded-2xl px-4 py-4 text-gray-900 text-base"
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  keyboardType="numeric"
                />
              </View>

              {/* Color Theme */}
              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-3">Color Theme</Text>
                <View className="flex-row flex-wrap">
                  {COLOR_THEMES.map((color: ColorTheme) => (
                    <TouchableOpacity
                      key={color.value}
                      onPress={() => handleSelectColor(color.value)}
                      className="w-16 h-16 rounded-2xl items-center justify-center mr-3 mb-3"
                      style={{
                        backgroundColor: color.value,
                        borderWidth: selectedColor === color.value ? 4 : 0,
                        borderColor: selectedColor === color.value ? '#80cbed' : 'transparent',
                      }}
                      activeOpacity={0.8}
                    >
                      {selectedColor === color.value && (
                        <View className="w-6 h-6 bg-white rounded-full" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Create Button */}
              <View className="px-6 mb-4">
                <TouchableOpacity
                  onPress={handleCreate}
                  className="bg-primary-500 rounded-2xl py-5 items-center"
                  activeOpacity={0.8}
                  disabled={!name.trim() || isSubmitting}
                >
                  <Text className="text-white text-lg font-bold">
                    {isSubmitting ? 'Creating...' : 'Create Goal'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
