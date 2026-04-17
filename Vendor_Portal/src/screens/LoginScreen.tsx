import React, { useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginUser, clearError } from '@/store/authSlice';
import { InputField, Button, ErrorMessage } from '@/components/CommonComponents';
import { theme } from '@/config/theme';
import { RootState, AppDispatch } from '@/store';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await dispatch(loginUser(data)).unwrap();
      if (result && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (submitError) {
      console.error('Login error:', submitError);
    }
  };

  useEffect(() => {
    if (isAuthenticated && onLoginSuccess) {
      onLoginSuccess();
    }
  }, [isAuthenticated, onLoginSuccess]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#F4F8FC', '#E9F1FA', '#F9FBFD']} style={styles.backgroundGlow} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.heroCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <LinearGradient colors={['#0F5FA8', '#0A4274']} style={styles.heroPanel}>
              <View style={styles.brandBadge}>
                <MaterialCommunityIcons name="shield-check-outline" size={24} color="#0F5FA8" />
              </View>
              <Text style={styles.appTitle}>Vendor Portal</Text>
              <Text style={styles.subtitle}>Simple, fast field updates for on-site investigation work.</Text>
              <View style={styles.heroPoints}>
                <View style={styles.heroPoint}>
                  <MaterialCommunityIcons name="clipboard-list-outline" size={18} color="#DCEEFF" />
                  <Text style={styles.heroPointText}>See assigned checks at a glance</Text>
                </View>
                <View style={styles.heroPoint}>
                  <MaterialCommunityIcons name="microphone-outline" size={18} color="#DCEEFF" />
                  <Text style={styles.heroPointText}>Record statements and submit evidence quickly</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.formShell}>
              {error && (
                <ErrorMessage
                  message={error}
                  onDismiss={() => dispatch(clearError())}
                />
              )}

              <Text style={styles.formTitle}>Sign in to continue</Text>
              <Text style={styles.formHint}>Use your assigned vendor credentials.</Text>

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <InputField
                    label="Email Address"
                    placeholder="Enter your email"
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <InputField
                    label="Password"
                    placeholder="Enter your password"
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry
                    error={errors.password?.message}
                  />
                )}
              />

              <Button
                title="Sign In"
                onPress={handleSubmit(onSubmit)}
                loading={isLoading}
                disabled={isLoading}
                style={styles.loginButton}
              />

              <View style={styles.footer}>
                <MaterialCommunityIcons name="headset" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.footerText}>Need access help? Contact your administrator.</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backgroundGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    ...theme.shadows.floating,
  },
  heroPanel: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  brandBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 18,
  },
  appTitle: {
    fontSize: 31,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#DCEEFF',
  },
  heroPoints: {
    marginTop: 18,
    gap: 10,
  },
  heroPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroPointText: {
    flex: 1,
    color: '#F2F8FF',
    fontSize: 14,
    lineHeight: 20,
  },
  formShell: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    backgroundColor: theme.colors.surface,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  formHint: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    marginBottom: 18,
  },
  loginButton: {
    marginTop: 6,
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default LoginScreen;
