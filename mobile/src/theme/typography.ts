import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: {
    heading: 'Poppins-Bold',
    body: 'Inter-Regular',
    mono: 'Menlo',
  },
  android: {
    heading: 'Poppins-Bold',
    body: 'Inter-Regular',
    mono: 'monospace',
  },
  default: {
    heading: 'Poppins-Bold',
    body: 'Inter-Regular',
    mono: 'monospace',
  },
});

const system = Platform.select({
  ios: {
    heading: 'System',
    body: 'System',
    mono: 'Menlo',
  },
  default: {
    heading: 'System',
    body: 'System',
    mono: 'monospace',
  },
});

export const typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontFamily: fontFamily.heading,
  } as TextStyle,
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily: fontFamily.heading,
  } as TextStyle,
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: fontFamily.heading,
  } as TextStyle,
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: fontFamily.heading,
  } as TextStyle,
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: fontFamily.body,
  } as TextStyle,
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: fontFamily.body,
  } as TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: fontFamily.body,
  } as TextStyle,
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: fontFamily.body,
  } as TextStyle,
  number: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1,
    fontFamily: fontFamily.body,
  } as TextStyle,
  numberSmall: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontFamily: fontFamily.body,
  } as TextStyle,
  button: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  } as TextStyle,
  buttonSmall: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  } as TextStyle,
  tab: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    fontFamily: fontFamily.body,
  } as TextStyle,
};

export type AppTypography = typeof typography;
