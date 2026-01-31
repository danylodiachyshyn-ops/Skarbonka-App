import { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Trash2 } from 'lucide-react-native';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { UserBox } from '@/src/lib/database.types';

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
  const { getColorForBox, setColorForBox, removeColorForBox } = useJarColor();
  const { updateBoxName, deleteUserBox, loading } = useBoxStore();
  const [editedName, setEditedName] = useState(currentBox?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentBox) {
      setEditedName(currentBox.name);
      setNameError(null);
    }
  }, [visible, currentBox?.id, currentBox?.name]);

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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl pt-6 pb-8 px-6">
            <SafeAreaView edges={['top']}>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-slate-800 text-2xl font-bold">Settings</Text>
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
                  <Text className="text-slate-500 text-sm mb-2 mt-4">Jar color</Text>
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

                <TouchableOpacity
                  onPress={handleDeletePiggyBank}
                  disabled={loading}
                  className="mt-8 flex-row items-center justify-center rounded-xl py-3.5 border border-red-200 bg-red-50"
                  activeOpacity={0.8}
                >
                  <Trash2 size={20} color="#dc2626" strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text className="text-red-600 font-semibold">Delete piggy bank</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text className="text-slate-500">Select a jar to change its color.</Text>
            )}
          </SafeAreaView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
