import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Send } from 'lucide-react-native';
import { BrandColors } from '@/src/lib/colors';

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 80 }: LogoProps) {
  return (
    <View
      className="rounded-3xl items-center justify-center shadow-lg overflow-hidden"
      style={{ width: size, height: size }}
    >
      <LinearGradient
        colors={[BrandColors.gradient.start, BrandColors.gradient.end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Send size={size * 0.5} color={BrandColors.white} fill={BrandColors.white} />
      </LinearGradient>
    </View>
  );
}
