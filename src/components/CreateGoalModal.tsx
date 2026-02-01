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
import { useLanguageContext } from '@/src/contexts/LanguageContext';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';

interface CreateGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onGoalCreated?: () => void;
}

const PRESET_OPTIONS: { key: JarColorPreset; labelKey: string }[] = [
  { key: 'emerald', labelKey: 'settings.presetEmerald' },
  { key: 'ocean', labelKey: 'settings.presetOcean' },
  { key: 'sunset', labelKey: 'settings.presetSunset' },
  { key: 'slate', labelKey: 'settings.presetSlate' },
];

const CURRENCY_OPTIONS: { code: string; labelKey: string }[] = [
  { code: 'EUR', labelKey: 'currency.eur' },
  { code: 'USD', labelKey: 'currency.usd' },
  { code: 'UAH', labelKey: 'currency.uah' },
  { code: 'GBP', labelKey: 'currency.gbp' },
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
  const { t } = useLanguageContext();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('createGoal.pleaseEnterGoalName'));
      return;
    }

    if (!user) {
      Alert.alert(t('common.error'), t('createGoal.mustBeLoggedIn'));
      return;
    }

    const target = targetAmount.trim() ? parseFloat(targetAmount) : null;
    if (targetAmount.trim() && (isNaN(target!) || target! <= 0)) {
      Alert.alert(t('common.error'), t('createGoal.enterValidTargetAmount'));
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
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('createGoal.failedToCreate'));
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
                <Text className="text-2xl font-bold text-gray-900">{t('createGoal.title')}</Text>
                <TouchableOpacity onPress={onClose} className="p-2">
                  <X size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-2">{t('createGoal.goalName')}</Text>
                <TextInput
                  className="bg-gray-50 rounded-2xl px-4 py-4 text-gray-900 text-base"
                  placeholder={t('createGoal.placeholderGoalName')}
                  placeholderTextColor="#9ca3af"
                  value={name}
                  onChangeText={setName}
                  maxLength={50}
                />
              </View>

              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-2">{t('createGoal.targetAmount')}</Text>
                <TextInput
                  className="bg-gray-50 rounded-2xl px-4 py-4 text-gray-900 text-base"
                  placeholder={t('createGoal.placeholderTarget')}
                  placeholderTextColor="#9ca3af"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  keyboardType="numeric"
                />
              </View>

              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-3">{t('createGoal.currency')}</Text>
                <View className="flex-row flex-wrap gap-3">
                  {CURRENCY_OPTIONS.map(({ code, labelKey }) => {
                    const isSelected = selectedCurrency === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        onPress={() => setSelectedCurrency(code)}
                        activeOpacity={0.8}
                        style={{ width: '47%' }}
                      >
                        <View
                          className="h-12 rounded-2xl items-center justify-center bg-slate-100 flex-row gap-2"
                          style={{
                            borderWidth: 2,
                            borderColor: isSelected ? '#1e40af' : 'transparent',
                          }}
                        >
                          <Currency size={20} color="#4b5563" strokeWidth={2} />
                          <Text className="text-slate-800 font-semibold">{t(labelKey)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="px-6 mb-6">
                <Text className="text-gray-500 text-sm mb-3">{t('createGoal.jarColor')}</Text>
                <View className="flex-row flex-wrap gap-3">
                  {PRESET_OPTIONS.map(({ key, labelKey }) => {
                    const colors = JAR_COLOR_PRESETS[key];
                    const isSelected = selectedPreset === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setSelectedPreset(key)}
                        activeOpacity={0.85}
                        style={{ width: '47%' }}
                      >
                        <View
                          className="h-14 rounded-2xl items-center justify-center"
                          style={{
                            backgroundColor: colors.button,
                            borderWidth: isSelected ? 2 : 0,
                            borderColor: 'rgba(0,0,0,0.25)',
                          }}
                        >
                          <Text className="text-white font-semibold">{t(labelKey)}</Text>
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
                    {isSubmitting ? t('createGoal.creating') : t('createGoal.createGoal')}
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
