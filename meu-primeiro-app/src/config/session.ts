import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'revira_session_token';

export function getSessionToken() {
  return Platform.OS === 'web'
    ? AsyncStorage.getItem(SESSION_TOKEN_KEY)
    : SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export function saveSessionToken(token: string) {
  return Platform.OS === 'web'
    ? AsyncStorage.setItem(SESSION_TOKEN_KEY, token)
    : SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken() {
  return Platform.OS === 'web'
    ? AsyncStorage.removeItem(SESSION_TOKEN_KEY)
    : SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
