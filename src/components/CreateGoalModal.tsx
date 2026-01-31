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
import { X, Currency } from 'lucide-react-native';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { useAuthStore } from '@/src/hooks/useAuthStore';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onGoalCreated?: () => void;
}

const PRESET_OPTIONS: { key: JarColorPreset; label: string }[] = [
  { key: 'emerald', label: 'Emerald' },
  { key: 'ocean', label: 'Ocean Blue' },
  { key: 'sunset', label: 'Sunset Orange' },
  { key: 'slate', label: 'Slate' },
];

const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'EUR', label: '€ Euro' },
  { code: 'USD', label: '$ US Dollar' },
  { code: 'UAH', label: '₴ Hryvnia' },
  { code: 'GBP', label: '£ British Pound' },
];

export default function CreateGoalModal({
  visible,
  onClose,
  onGoalCreated,
}: CreateGoalModalProps) {
  if (!visible) return null;

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');
  const [selectedPreset, setSelectedPreset] = useState<JarColorPreset>('ocean');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();
  const { createUserBox } = useBoxStore();
  const { setColorForBox } = useJarColor();

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
      const newBoxId = await createUserBox(name.trim(), target ?? undefined, selectedCurrency);

      if (newBoxId) {
        await setColorForBox(newBoxId, selectedPreset);
      }

      setName('');
      setTargetAmount('');
      setSelectedCurrency('EUR');
      setSelectedPreset('ocean');
      onClose();
      onGoalCreated?.();
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create goal');
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
              <View className="flex-row justify-between items-center px-6 mb-6">
                <Text className="text-2xl font-bold text-gray-900">Create New Goal</Text>
                <TouchableOpacity onPress={onClose} className="p-2">
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

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

              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-3">Currency</Text>
                <View className="flex-row flex-wrap gap-3">
                  {CURRENCY_OPTIONS.map(({ code, label }) => {
                    const isSelected = selectedCurrency === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        onPress={() => setSelectedCurrency(code)}
                        className="rounded-2xl overflow-hidden"
                        style={{
                          width: '47%',
                          borderWidth: isSelected ? 3 : 0,
                          borderColor: JAR_COLOR_PRESETS[selectedPreset].button,
                        }}
                        activeOpacity={0.8}
                      >
                        <View className="h-14 rounded-2xl items-center justify-center bg-gray-100 flex-row gap-2">
                          <Currency size={20} color="#4b5563" strokeWidth={2} />
                          <Text className="text-gray-800 font-semibold">{label}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-3">Jar color</Text>
                <View className="flex-row flex-wrap gap-3">
                  {PRESET_OPTIONS.map(({ key, label }) => {
                    const colors = JAR_COLOR_PRESETS[key];
                    const isSelected = selectedPreset === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setSelectedPreset(key)}
                        className="rounded-2xl overflow-hidden"
                        style={{
                          width: '47%',
                          borderWidth: isSelected ? 3 : 0,
                          borderColor: colors.button,
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          className="h-14 rounded-2xl items-center justify-center"
                          style={{ backgroundColor: colors.button }}
                        >
                          <Text className="text-white font-semibold">{label}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="px-6 mb-4">
                <TouchableOpacity
                  onPress={handleCreate}
                  className="rounded-2xl py-5 items-center"
                  style={{ backgroundColor: JAR_COLOR_PRESETS[selectedPreset].button }}
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
