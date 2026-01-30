import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InvestScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-gray-500 text-lg">Invest</Text>
        <Text className="text-gray-400 text-sm mt-2">Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}
