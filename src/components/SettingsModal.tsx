import { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Trash2, Archive } from 'lucide-react-native';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { UserBox } from '@/src/lib/database.types';

const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: 'EUR', label: '€ Euro' },
  { code: 'USD', label: '$ US Dollar' },
  { code: 'UAH', label: '₴ Hryvnia' },
  { code: 'GBP', label: '£ British Pound' },
];

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  currentBox: UserBox | null;
}

const PRESET_LABELS: Record<JarColorPreset, string> = {
  emerald: 'Emerald',
  ocean: 'Ocean Blue',
  sunset: 'Sunset Orange',
  slate: 'Slate',
};

export default function SettingsModal({
  visible,
  onClose,
  currentBox,
}: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { getColorForBox, setColorForBox, removeColorForBox } = useJarColor();
  const { updateBoxName, updateBoxTargetAmount, updateBoxCurrencyWithConversion, archiveUserBox, deleteUserBox, loading } = useBoxStore();
  const [editedName, setEditedName] = useState(currentBox?.name ?? '');
  const [editedTarget, setEditedTarget] = useState(
    currentBox?.target_amount != null && Number(currentBox.target_amount) > 0
      ? String(Number(currentBox.target_amount))
      : ''
  );
  const [editedCurrency, setEditedCurrency] = useState(currentBox?.currency ?? 'EUR');
  const [nameError, setNameError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentBox) {
      setEditedName(currentBox.name);
      setEditedTarget(
        currentBox.target_amount != null && Number(currentBox.target_amount) > 0
          ? String(Number(currentBox.target_amount))
          : ''
      );
      setEditedCurrency(currentBox.currency ?? 'EUR');
      setNameError(null);
      setTargetError(null);
    }
  }, [visible, currentBox?.id, currentBox?.name, currentBox?.target_amount, currentBox?.currency]);

  if (!visible) return null;

  const currentPreset = currentBox ? getColorForBox(currentBox.id) : 'ocean';

  const handleSaveName = async () => {
    if (!currentBox) return;
    const trimmed = editedName.trim();
    if (!trimmed) {
      setNameError('Name cannot be empty');
      return;
    }
    setNameError(null);
    try {
      await updateBoxName(currentBox.id, trimmed);
    } catch {
      setNameError('Failed to update name');
    }
  };

  const handleSaveTarget = async () => {
    if (!currentBox) return;
    setTargetError(null);
    const raw = editedTarget.trim();
    if (!raw) {
      try {
        await updateBoxTargetAmount(currentBox.id, null);
      } catch {
        setTargetError('Failed to update');
      }
      return;
    }
    const value = parseFloat(raw);
    if (isNaN(value) || value < 0) {
      setTargetError('Enter a valid amount');
      return;
    }
    try {
      await updateBoxTargetAmount(currentBox.id, value);
    } catch {
      setTargetError('Failed to update target');
    }
  };

  const handleArchivePiggyBank = () => {
    if (!currentBox) return;
    Alert.alert(
      'Archive goal',
      'Move this jar to Archive? You can restore it later from Profile → Archive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              await archiveUserBox(currentBox.id);
              onClose();
            } catch {
              setNameError('Failed to archive');
            }
          },
        },
      ]
    );
  };

  const handleDeletePiggyBank = () => {
    if (!currentBox) return;
    Alert.alert(
      'Delete piggy bank',
      'Are you sure you want to delete this piggy bank? All transactions and saved amount will be permanently removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserBox(currentBox.id);
              await removeColorForBox(currentBox.id);
              onClose();
            } catch {
              setNameError('Failed to delete piggy bank');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
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
              height: '80%',
            }}
          >
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
              <View
                className="flex-row justify-between items-center px-5 pb-2"
                style={{ paddingTop: Math.max(insets.top, 16) }}
              >
                <Text className="text-slate-800 text-2xl font-bold">Settings</Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center"
                >
                  <X size={22} color="#475569" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
              {currentBox ? (
                <>
                  <View className="mb-4">
                  <Text className="text-slate-500 text-sm mb-2">Piggy bank name</Text>
                  <View className="flex-row items-center gap-2 mb-1">
                    <TextInput
                      value={editedName}
                      onChangeText={(t) => {
                        setEditedName(t);
                        if (nameError) setNameError(null);
                      }}
                      placeholder="Enter name"
                      placeholderTextColor="#94a3b8"
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
                      editable={!loading}
                      maxLength={64}
                    />
                    <TouchableOpacity
                      onPress={handleSaveName}
                      disabled={loading || editedName.trim() === currentBox.name}
                      className="rounded-xl bg-slate-800 px-4 py-3 min-w-[72px] items-center"
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {nameError ? (
                    <Text className="text-red-500 text-sm mb-3">{nameError}</Text>
                  ) : null}
                  </View>

                  <View className="mb-4">
                  <Text className="text-slate-500 text-sm mb-2">Target amount</Text>
                  <View className="flex-row items-center gap-2 mb-1">
                    <TextInput
                      value={editedTarget}
                      onChangeText={(t) => {
                        setEditedTarget(t);
                        if (targetError) setTargetError(null);
                      }}
                      placeholder="0 (leave empty for no goal)"
                      placeholderTextColor="#94a3b8"
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base"
                      keyboardType="numeric"
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={handleSaveTarget}
                      disabled={
                        loading ||
                        (editedTarget.trim() ===
                          (currentBox?.target_amount != null && Number(currentBox.target_amount) > 0
                            ? String(Number(currentBox.target_amount))
                            : ''))
                      }
                      className="rounded-xl bg-slate-800 px-4 py-3 min-w-[72px] items-center"
                    >
                      <Text className="text-white font-semibold">Save</Text>
                    </TouchableOpacity>
                  </View>
                  {targetError ? (
                    <Text className="text-red-500 text-sm mb-3">{targetError}</Text>
                  ) : null}
                  </View>

                  <View className="mb-4">
                  <Text className="text-slate-500 text-sm mb-2">Currency</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {CURRENCY_OPTIONS.map(({ code, label }) => {
                      const isSelected = editedCurrency === code;
                      return (
                        <TouchableOpacity
                          key={code}
                          onPress={async () => {
                            setEditedCurrency(code);
                            if (currentBox && code !== (currentBox?.currency ?? 'EUR')) {
                              try {
                                await updateBoxCurrencyWithConversion(currentBox.id, code);
                              } catch (e: any) {
                                setTargetError(e?.message ?? 'Failed to convert currency');
                              }
                            }
                          }}
                          className="rounded-2xl overflow-hidden"
                          style={{
                            width: '47%',
                            borderWidth: isSelected ? 3 : 0,
                            borderColor: '#1e40af',
                          }}
                          activeOpacity={0.8}
                          disabled={loading}
                        >
                          <View className="h-12 rounded-2xl items-center justify-center bg-slate-100 flex-row gap-2">
                            <Text className="text-slate-800 font-semibold">{label}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  </View>

                  <View className="mb-4">
                  <Text className="text-slate-500 text-sm mb-2">Jar color</Text>
                <View className="flex-row flex-wrap gap-3">
                  {(Object.keys(JAR_COLOR_PRESETS) as JarColorPreset[]).map((preset) => {
                    const isSelected = currentPreset === preset;
                    const colors = JAR_COLOR_PRESETS[preset];
                    return (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setColorForBox(currentBox.id, preset)}
                        className="rounded-3xl overflow-hidden"
                        style={{
                          width: '47%',
                          borderWidth: isSelected ? 3 : 0,
                          borderColor: colors.button,
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          className="h-14 rounded-3xl items-center justify-center"
                          style={{ backgroundColor: colors.button }}
                        >
                          <Text className="text-white font-semibold">
                            {PRESET_LABELS[preset]}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                </View>

                <TouchableOpacity
                  onPress={handleArchivePiggyBank}
                  disabled={loading}
                  className="mt-6 flex-row items-center justify-center rounded-xl py-3.5 border border-slate-200 bg-slate-100"
                  activeOpacity={0.8}
                >
                  <Archive size={20} color="#475569" strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text className="text-slate-700 font-semibold">Archive goal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeletePiggyBank}
                  disabled={loading}
                  className="mt-3 flex-row items-center justify-center rounded-xl py-3.5 border border-red-200 bg-red-50"
                  activeOpacity={0.8}
                >
                  <Trash2 size={20} color="#dc2626" strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text className="text-red-600 font-semibold">Delete piggy bank</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View className="py-4">
                <Text className="text-slate-500">Select a jar to change its settings.</Text>
              </View>
            )}
              </ScrollView>
          </SafeAreaView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
