import { TextStyle } from 'react-native';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  mono: 'monospace',
} as const;

export const fontAssets = {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
};

export const typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontFamily: fonts.bold,
  } as TextStyle,
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily: fonts.bold,
  } as TextStyle,
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  } as TextStyle,
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: fonts.regular,
  } as TextStyle,
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: fonts.regular,
  } as TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: fonts.medium,
  } as TextStyle,
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: fonts.semiBold,
  } as TextStyle,
  number: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1,
    fontFamily: fonts.bold,
  } as TextStyle,
  numberSmall: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontFamily: fonts.bold,
  } as TextStyle,
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  } as TextStyle,
  buttonSmall: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  } as TextStyle,
  tab: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  } as TextStyle,
};

export type AppTypography = typeof typography;
