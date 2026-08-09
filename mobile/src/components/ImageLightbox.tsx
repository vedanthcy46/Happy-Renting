import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as CachedImage } from 'expo-image';
import { useTheme } from '../theme/ThemeProvider';
import { spacing, radius } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface ImageLightboxProps {
  uri: string;
  visible: boolean;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ uri, visible, onClose }) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <CachedImage
            source={{ uri }}
            style={styles.image}
            contentFit="contain"
            cachePolicy="memory"
          />
        </TouchableOpacity>
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
        <Ionicons name="close" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.75,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
