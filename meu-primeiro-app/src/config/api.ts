import { Platform } from 'react-native';

// Altere para o IP da sua máquina se estiver testando no celular físico (Expo Go)
const LOCAL_IP = '192.168.1.7';
const LOCAL_PORT = '3000';


export const API_BASE_URL = Platform.OS === 'web'
  ? `http://localhost:${LOCAL_PORT}`
  : `http://${LOCAL_IP}:${LOCAL_PORT}`;

export function resolveProfileImageUrl(photo: string | null | undefined): string | null {
  if (!photo) return null;
  if (photo.startsWith('data:') || /^https?:\/\//.test(photo)) return photo;
  return `${API_BASE_URL}${photo}`;
}