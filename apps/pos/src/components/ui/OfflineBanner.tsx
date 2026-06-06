import { StyleSheet, Text, View } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { colors, fontSize, fontWeight, spacing } from '@yardflow/theme';
import { useNetworkStatus } from '../../lib/network';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <WifiOff size={14} color="#fff" strokeWidth={1.75} />
      <Text style={styles.text}>No network — changes are blocked until reconnected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.red[700],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  text: {
    color: '#fff',
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
});
