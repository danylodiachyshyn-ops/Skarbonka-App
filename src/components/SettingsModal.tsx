import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useJarColor, JAR_COLOR_PRESETS, JarColorPreset } from '@/src/contexts/JarColorContext';
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
  const { getColorForBox, setColorForBox } = useJarColor();

  if (!visible) return null;

  const currentPreset = currentBox ? getColorForBox(currentBox.id) : 'ocean';

  return (
    <Modal visible={visible} animationType="slide" transparent>
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
                <Text className="text-slate-500 text-sm mb-2">Jar color</Text>
                <Text className="text-slate-700 font-medium mb-3">{currentBox.name}</Text>
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
              </>
            ) : (
              <Text className="text-slate-500">Select a jar to change its color.</Text>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
