import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  onDismiss?: () => void;
  actions?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}

const TOAST_ICONS: Record<ToastType, { name: string; color: string; bg: string; border: string }> = {
  success: {
    name: 'check-circle',
    color: '#15803D',
    bg: '#F0FDF4',
    border: '#BBF7D0',
  },
  error: {
    name: 'alert-circle',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#FECACA',
  },
  warning: {
    name: 'alert',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#FDE68A',
  },
  info: {
    name: 'information',
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
};

// ─── Singleton controller ───────────────────────────────────────────
let _showToast: ((config: ToastConfig) => void) | null = null;

export function showToast(config: ToastConfig) {
  if (_showToast) {
    _showToast(config);
  }
}

// ─── Dialog (confirmation with actions) ─────────────────────────────
let _showDialog: ((config: ToastConfig) => void) | null = null;

export function showDialog(config: ToastConfig) {
  if (_showDialog) {
    _showDialog(config);
  }
}

// ─── Toast Provider (renders at root) ───────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  // Toast state
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dialog state
  const [dialog, setDialog] = useState<ToastConfig | null>(null);
  const dialogOpacity = useRef(new Animated.Value(0)).current;
  const dialogScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    _showToast = (config: ToastConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(config);
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const dur = config.duration ?? 3000;
      timerRef.current = setTimeout(() => dismissToast(config.onDismiss), dur);
    };

    _showDialog = (config: ToastConfig) => {
      setDialog(config);
      dialogOpacity.setValue(0);
      dialogScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(dialogOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(dialogScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }),
      ]).start();
    };

    return () => {
      _showToast = null;
      _showDialog = null;
    };
  }, []);

  const dismissToast = (onDismiss?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
      onDismiss?.();
    });
  };

  const dismissDialog = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(dialogOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dialogScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDialog(null);
      callback?.();
    });
  };

  const toastStyle = toast ? TOAST_ICONS[toast.type] : null;
  const dialogStyle = dialog ? TOAST_ICONS[dialog.type] : null;

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* ── Toast (auto-dismiss notification) ── */}
      {toast && toastStyle && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              top: insets.top + 8,
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
              backgroundColor: toastStyle.bg,
              borderColor: toastStyle.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.toastContent}
            activeOpacity={0.9}
            onPress={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              dismissToast(toast.onDismiss);
            }}
          >
            <View style={[styles.toastIconWrap, { backgroundColor: toastStyle.color + '15' }]}>
              <MaterialCommunityIcons
                name={toastStyle.name as any}
                size={22}
                color={toastStyle.color}
              />
            </View>
            <View style={styles.toastTextWrap}>
              <Text style={[styles.toastTitle, { color: toastStyle.color }]} numberOfLines={1}>
                {toast.title}
              </Text>
              <Text style={styles.toastMessage} numberOfLines={3}>
                {toast.message}
              </Text>
            </View>
            <MaterialCommunityIcons name="close" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Dialog (with action buttons) ── */}
      {dialog && dialogStyle && (
        <Modal transparent visible animationType="none">
          <Animated.View style={[styles.dialogOverlay, { opacity: dialogOpacity }]}>
            <Animated.View
              style={[
                styles.dialogBox,
                { transform: [{ scale: dialogScale }] },
              ]}
            >
              <View style={[styles.dialogIconRow, { backgroundColor: dialogStyle.bg }]}>
                <View style={[styles.dialogIconCircle, { backgroundColor: dialogStyle.color + '18' }]}>
                  <MaterialCommunityIcons
                    name={dialogStyle.name as any}
                    size={28}
                    color={dialogStyle.color}
                  />
                </View>
              </View>

              <Text style={[styles.dialogTitle, { color: dialogStyle.color }]}>
                {dialog.title}
              </Text>
              <Text style={styles.dialogMessage}>{dialog.message}</Text>

              <View style={styles.dialogActions}>
                {(dialog.actions || [{ text: 'OK' }]).map((action, idx) => {
                  const isDestructive = action.style === 'destructive';
                  const isCancel = action.style === 'cancel';
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dialogButton,
                        isDestructive && styles.dialogButtonDestructive,
                        isCancel && styles.dialogButtonCancel,
                        !isDestructive && !isCancel && { backgroundColor: dialogStyle.color },
                      ]}
                      onPress={() => dismissDialog(action.onPress)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.dialogButtonText,
                          isCancel && styles.dialogButtonTextCancel,
                        ]}
                      >
                        {action.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Toast ──
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  toastIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },

  // ── Dialog ──
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  dialogIconRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  dialogIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  dialogActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  dialogButtonDestructive: {
    backgroundColor: '#DC2626',
  },
  dialogButtonCancel: {
    backgroundColor: '#F1F5F9',
  },
  dialogButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  dialogButtonTextCancel: {
    color: '#475569',
  },
});
