import { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Trash2, Archive } from 'lucide-react-native';
import { useLanguageContext } from '@/src/contexts/LanguageContext';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';
import { useBoxStore } from '@/src/hooks/useBoxStore';
import { UserBox } from '@/src/lib/database.types';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  currentBox: UserBox | null;
}

const PRESET_LABEL_KEYS: Record<JarColorPreset, string> = {
  emerald: 'settings.presetEmerald',
  ocean: 'settings.presetOcean',
  sunset: 'settings.presetSunset',
  slate: 'settings.presetSlate',
};

export default function SettingsModal({
  visible,
  onClose,
  currentBox,
}: SettingsModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguageContext();
  const { getColorForBox, setColorForBox, removeColorForBox } = useJarColor();
  const { updateBoxName, updateBoxTargetAmount, archiveUserBox, deleteUserBox, loading } = useBoxStore();
  const [editedName, setEditedName] = useState(currentBox?.name ?? '');
  const [editedTarget, setEditedTarget] = useState(
    currentBox?.target_amount != null && Number(currentBox.target_amount) > 0
      ? String(Number(currentBox.target_amount))
      : ''
  );
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
      setNameError(null);
      setTargetError(null);
    }
  }, [visible, currentBox?.id, currentBox?.name, currentBox?.target_amount]);

  if (!visible) return null;

  const currentPreset = currentBox ? getColorForBox(currentBox.id) : 'ocean';

  const handleSaveName = async () => {
    if (!currentBox) return;
    const trimmed = editedName.trim();
    if (!trimmed) {
      setNameError(t('settings.nameCannotBeEmpty'));
      return;
    }
    setNameError(null);
    try {
      await updateBoxName(currentBox.id, trimmed);
    } catch {
      setNameError(t('settings.failedToUpdateName'));
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
        setTargetError(t('settings.failedToUpdate'));
      }
      return;
    }
    const value = parseFloat(raw);
    if (isNaN(value) || value < 0) {
      setTargetError(t('settings.enterValidAmount'));
      return;
    }
    try {
      await updateBoxTargetAmount(currentBox.id, value);
    } catch {
      setTargetError(t('settings.failedToUpdateTarget'));
    }
  };

  const handleArchivePiggyBank = () => {
    if (!currentBox) return;
    Alert.alert(
      t('settings.archiveGoal'),
      t('settings.archiveGoalConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.archiveButton'),
          onPress: async () => {
            try {
              await archiveUserBox(currentBox.id);
              onClose();
            } catch {
              setNameError(t('settings.failedToArchive'));
            }
          },
        },
      ]
    );
  };

  const handleDeletePiggyBank = () => {
    if (!currentBox) return;
    Alert.alert(
      t('settings.deletePiggyBank'),
      t('settings.deletePiggyBankConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserBox(currentBox.id);
              await removeColorForBox(currentBox.id);
              onClose();
            } catch {
              setNameError(t('settings.failedToDelete'));
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
                <Text className="text-slate-800 text-2xl font-bold">{t('settings.title')}</Text>
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
                  <Text className="text-slate-500 text-sm mb-2">{t('settings.piggyBankName')}</Text>
                  <View className="flex-row items-center gap-2 mb-1">
                    <TextInput
                      value={editedName}
                      onChangeText={(t) => {
                        setEditedName(t);
                        if (nameError) setNameError(null);
                      }}
                      placeholder={t('settings.enterName')}
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
                        <Text className="text-white font-semibold">{t('common.save')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {nameError ? (
                    <Text className="text-red-500 text-sm mb-3">{nameError}</Text>
                  ) : null}
                  </View>

                  <View className="mb-4">
                  <Text className="text-slate-500 text-sm mb-2">{t('settings.targetAmount')}</Text>
                  <View className="flex-row items-center gap-2 mb-1">
                    <TextInput
                      value={editedTarget}
                      onChangeText={(t) => {
                        setEditedTarget(t);
                        if (targetError) setTargetError(null);
                      }}
                      placeholder={t('settings.leaveEmptyForNoGoal')}
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
                      {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">{t('common.save')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {targetError ? (
                    <Text className="text-red-500 text-sm mb-3">{targetError}</Text>
                  ) : null}
                  </View>

                  <View className="mb-4">
                  <Text className="text-slate-500 text-sm mb-2">{t('settings.jarColor')}</Text>
                <View className="flex-row flex-wrap gap-3">
                  {(Object.keys(JAR_COLOR_PRESETS) as JarColorPreset[]).map((preset) => {
                    const isSelected = currentPreset === preset;
                    const colors = JAR_COLOR_PRESETS[preset];
                    return (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setColorForBox(currentBox.id, preset)}
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
                          <Text className="text-white font-semibold">
                            {t(PRESET_LABEL_KEYS[preset])}
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
                  <Text className="text-slate-700 font-semibold">{t('settings.archiveGoal')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDeletePiggyBank}
                  disabled={loading}
                  className="mt-3 flex-row items-center justify-center rounded-xl py-3.5 border border-red-200 bg-red-50"
                  activeOpacity={0.8}
                >
                  <Trash2 size={20} color="#dc2626" strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text className="text-red-600 font-semibold">{t('settings.deletePiggyBank')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View className="py-4">
                <Text className="text-slate-500">{t('settings.selectJarToChange')}</Text>
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
