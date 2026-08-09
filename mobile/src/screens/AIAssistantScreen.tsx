import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { typography, spacing, radius } from '../theme';
import { AppHeader } from '../components';
import { useAiChat } from '../hooks/useAiChat';
import { Workspace } from '../types/ai';

function parseInline(text: string, color: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={i} style={[styles.inlineBold, { color }]}>{part.slice(2, -2)}</Text>
    ) : (
      <Text key={i} style={{ color }}>{part}</Text>
    )
  );
}

function MessageBubble({ message, isUser }: { message: string; isUser: boolean }) {
  const { colors } = useTheme();
  const bg = isUser ? colors.primary : colors.surface;
  const textColor = isUser ? '#FFFFFF' : colors.text.primary;
  const alignSelf = isUser ? 'flex-end' : 'flex-start';

  return (
    <View style={[styles.bubble, { backgroundColor: bg, alignSelf }]}>
      {message.split('\n').map((line, i) => {
        if (!line.trim()) return <View key={i} style={{ height: 6 }} />;
        if (/^\s*-\s+/.test(line)) {
          return (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: isUser ? 'rgba(255,255,255,0.7)' : colors.primary }]} />
              <Text style={{ color: textColor, flex: 1, ...typography.body }}>{parseInline(line.replace(/^\s*-\s+/, ''), textColor)}</Text>
            </View>
          );
        }
        if (/^\*\*/.test(line.trim())) {
          return (
            <View key={i} style={[styles.budget, { borderLeftColor: colors.accent }]}>
              <Text style={styles.budgetText}>{parseInline(line, textColor)}</Text>
            </View>
          );
        }
        return <Text key={i} style={[styles.bodyText, { color: textColor }]}>{parseInline(line, textColor)}</Text>;
      })}
    </View>
  );
}

export const AIAssistantScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { messages, isLoading, error, send, clearChat, workspace } = useAiChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const headerHeight = useRef(0);

  const isOwner = workspace === 'owner';
  const suggestions = isOwner
    ? [t('ai.sOwner1'), t('ai.sOwner2'), t('ai.sOwner3'), t('ai.sOwner4'), t('ai.sOwner5'), t('ai.sOwner6'), t('ai.sOwner7'), t('ai.sOwner8'), t('ai.sOwner9'), t('ai.sOwner10')]
    : [t('ai.sTenant1'), t('ai.sTenant2'), t('ai.sTenant3'), t('ai.sTenant4'), t('ai.sTenant5')];
  const subtitle = isOwner ? t('ai.subtitleOwner') : t('ai.subtitleTenant');

  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant';
  const showFollowUps = !isLoading && lastIsAssistant;

  const iosOffset = Platform.OS === 'ios' ? headerHeight.current + insets.top : 0;

  const submit = (text: string) => {
    const value = text.trim();
    setInput('');
    send(value);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View onLayout={(e) => { headerHeight.current = e.nativeEvent.layout.height; }}>
        <AppHeader
          title={t('ai.titleAssistant')}
          subtitle={subtitle}
          rightIcon="trash-outline"
          onRightPress={clearChat}
          onBack={() => router.back()}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={iosOffset}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.logoRing, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="sparkles" size={34} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
                {isOwner ? t('ai.emptyTitleOwner') : t('ai.emptyTitleTenant')}
              </Text>
              <Text style={[styles.emptySub, { color: colors.text.secondary }]}>
                {isOwner ? t('ai.emptySubOwner') : t('ai.emptySubTenant')}
              </Text>
              <View style={styles.suggestions}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => submit(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, { color: colors.text.primary }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m, i) => (
              <MessageBubble key={i} message={m.content} isUser={m.role === 'user'} />
            ))
          )}

          {isLoading && (
            <View style={[styles.bubble, { backgroundColor: colors.surface, alignSelf: 'flex-start' }]}>
              <View style={styles.typingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.typing, { color: colors.text.secondary }]}>{t('ai.thinking')}</Text>
              </View>
            </View>
          )}

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {showFollowUps && (
            <View style={styles.followUps}>
              <Text style={[styles.followUpTitle, { color: colors.text.tertiary }]}>{t('ai.followUpTitle')}</Text>
              <View style={styles.suggestions}>
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => submit(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, { color: colors.text.primary }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.chip, styles.askElseChip, { borderColor: colors.primary }]}
                  onPress={() => inputRef.current?.focus()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                  <Text style={[styles.chipText, { color: colors.primary }]}>{t('ai.askElse')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: spacing.md + insets.bottom }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { backgroundColor: colors.card, color: colors.text.primary }]}
            placeholder={isOwner ? t('ai.placeholderOwner') : t('ai.placeholderTenant')}
            placeholderTextColor={colors.text.tertiary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            onSubmitEditing={() => input.trim() && submit(input)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() && !isLoading ? colors.primary : colors.border }]}
            onPress={() => input.trim() && submit(input)}
            disabled={!input.trim() || isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  chatContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  empty: { alignItems: 'center', paddingTop: spacing.massive },
  logoRing: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { ...typography.h4, marginBottom: spacing.sm },
  emptySub: { ...typography.body, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  suggestions: { width: '100%', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chipText: { ...typography.body },
  followUps: { marginTop: spacing.sm },
  followUpTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  askElseChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bubble: { maxWidth: '88%', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.md },
  bulletRow: { flexDirection: 'row', marginVertical: 2, flex: 1 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: spacing.sm, marginTop: 8 },
  budget: { borderLeftWidth: 3, paddingLeft: spacing.md, marginVertical: 2 },
  budgetText: { ...typography.body },
  inlineBold: { fontWeight: '700' },
  bodyText: { ...typography.body, lineHeight: 20 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typing: { ...typography.body },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.sm },
  errorText: { flex: 1, ...typography.body },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, maxHeight: 120, ...typography.body },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
});