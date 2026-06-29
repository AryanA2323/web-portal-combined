import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryStore: Record<string, string> = {};

const canUseLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return canUseLocalStorage() ? window.localStorage.getItem(key) : memoryStore[key] ?? null;
    }

    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (canUseLocalStorage()) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStore[key] = value;
      }
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (canUseLocalStorage()) {
        window.localStorage.removeItem(key);
      }
      delete memoryStore[key];
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

export default storage;
