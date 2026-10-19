import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { clearSessionToken, getSessionToken } from '../config/session';

const CATEGORIES = [
  { key: 'messages', title: 'Novas mensagens', description: 'Quando alguém enviar uma mensagem pelo app.', icon: 'message-text-outline' },
  { key: 'security', title: 'Segurança da conta', description: 'Novos acessos e atividades importantes na sua conta.', icon: 'shield-check-outline' },
  { key: 'listings', title: 'Atividade nos anúncios', description: 'Interesse, disponibilidade e atualizações dos anúncios.', icon: 'storefront-outline' },
  { key: 'transactions', title: 'Transações e coletas', description: 'Atualizações de negociações e coletas.', icon: 'truck-delivery-outline' },
  { key: 'product_updates', title: 'Novidades do Revira', description: 'Novos recursos, melhorias e comunicados do app.', icon: 'new-box' },
] as const;

type NotificationCategory = typeof CATEGORIES[number]['key'];
type Preferences = Record<NotificationCategory, boolean>;

const DEFAULT_PREFERENCES: Preferences = {
  messages: true,
  security: true,
  listings: true,
  transactions: true,
  product_updates: false,
};

export default function NotificacoesScreen() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null);
  const [savingPush, setSavingPush] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const carregarPreferencias = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const token = await getSessionToken();
      if (!token) {
        await AsyncStorage.removeItem('@usuario_logado');
        router.replace('/');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/usuario/notificacoes/preferencias`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        await AsyncStorage.removeItem('@usuario_logado');
        await clearSessionToken();
        router.replace('/');
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.mensagem || 'Não foi possível carregar as preferências.');

      setPreferences({ ...DEFAULT_PREFERENCES, ...body.categorias });
      setPushEnabled(Boolean(body.push_ativo));
    } catch (loadError) {
      console.error('Erro ao carregar preferências de notificação:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar as preferências.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void carregarPreferencias();
    }, [carregarPreferencias])
  );

  const salvarPreferencia = async (category: NotificationCategory, enabled: boolean) => {
    const updated = { ...preferences, [category]: enabled };
    setSavingCategory(category);
    setError('');
    setNotice('');
    try {
      const token = await getSessionToken();
      const response = await fetch(`${API_BASE_URL}/usuario/notificacoes/preferencias`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ categorias: updated }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.mensagem || 'Não foi possível salvar esta opção.');
      setPreferences(updated);
    } catch (saveError) {
      console.error('Erro ao salvar preferência de notificação:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a opção.');
    } finally {
      setSavingCategory(null);
    }
  };

  const atualizarPush = async (enable: boolean) => {
    setSavingPush(true);
    setError('');
    setNotice('');
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sua sessão expirou. Entre novamente.');

      if (!enable) {
        const response = await fetch(`${API_BASE_URL}/usuario/notificacoes/dispositivo-atual`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.mensagem || 'Não foi possível desativar as notificações.');
        setPushEnabled(false);
        return;
      }

      if (Platform.OS === 'web') {
        throw new Error('Notificações push ainda podem ser ativadas apenas no aplicativo para celular.');
      }
      if (!Device.isDevice) {
        throw new Error('Use um celular físico para ativar notificações push.');
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (!projectId) {
        throw new Error('O app ainda precisa ser vinculado a um projeto EAS para ativar notificações push.');
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Notificações',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('A permissão foi negada. Ative notificações para o Revira nas configurações do celular.');
      }

      const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
      const response = await fetch(`${API_BASE_URL}/usuario/notificacoes/dispositivo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expo_push_token: pushToken.data,
          dispositivo: `${Device.osName || Platform.OS}${Device.modelName ? ` · ${Device.modelName}` : ''}`,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.mensagem || 'Não foi possível registrar este celular.');

      setPushEnabled(true);
      setNotice('Notificações push ativadas neste dispositivo.');
    } catch (pushError) {
      console.error('Erro ao configurar notificações push:', pushError);
      setError(pushError instanceof Error ? pushError.message : 'Não foi possível alterar notificações push.');
    } finally {
      setSavingPush(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        accessibilityLabel="Voltar"
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.helperText}>Carregando notificações...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void carregarPreferencias(true)}
              tintColor="#2E7D32"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>Notificações</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <MaterialCommunityIcons name="bell-ring-outline" size={25} color="#E65100" />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>Escolha o que deseja receber</Text>
              <Text style={styles.helperText}>As opções são salvas na sua conta.</Text>
            </View>
          </View>

          <Text style={styles.pushHint}>Push não implementado.</Text>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categorias</Text>
            <Text style={styles.sectionSubtitle}>Ligue ou desligue cada tipo de alerta</Text>
          </View>

          <View style={styles.optionsCard}>
            {CATEGORIES.map((category, index) => (
              <React.Fragment key={category.key}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.optionRow}>
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons name={category.icon} size={21} color="#2E7D32" />
                  </View>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowTitle}>{category.title}</Text>
                    <Text style={styles.rowDescription}>{category.description}</Text>
                  </View>
                  {savingCategory === category.key
                    ? <ActivityIndicator size="small" color="#2E7D32" />
                    : (
                      <Switch
                        value={preferences[category.key]}
                        onValueChange={(value) => void salvarPreferencia(category.key, value)}
                        trackColor={{ false: '#CFD8DC', true: '#A5D6A7' }}
                        thumbColor={preferences[category.key] ? '#2E7D32' : '#90A4AE'}
                        accessibilityLabel={`${category.title}: ${preferences[category.key] ? 'ativado' : 'desativado'}`}
                        disabled={savingCategory !== null}
                      />
                    )}
                </View>
              </React.Fragment>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {notice ? <Text style={styles.successText}>{notice}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  backButton: {
    position: 'absolute', zIndex: 10, elevation: 10,
    top: Platform.OS === 'android' ? 40 : 12, left: 16,
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E9',
    justifyContent: 'center', alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingTop: Platform.OS === 'android' ? 40 : 12, paddingBottom: 16,
  },
  headerSpacer: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  helperText: { color: '#718075', fontSize: 12, lineHeight: 17 },
  introCard: {
    flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E8F5E9', marginBottom: 15,
  },
  introIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, gap: 3 },
  introTitle: { color: '#1B5E20', fontSize: 15, fontWeight: '700' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowTitle: { color: '#1B241D', fontSize: 14, fontWeight: '700' },
  rowDescription: { color: '#718075', fontSize: 11, lineHeight: 16, marginTop: 3 },
  pushHint: { color: '#1B5E20', fontSize: 14, fontWeight: '600', marginTop: 4 },
  sectionHeader: { marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: '#1B5E20', fontSize: 17, fontWeight: '700' },
  sectionSubtitle: { color: '#718075', fontSize: 12, marginTop: 3 },
  optionsCard: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8F5E9', paddingHorizontal: 13 },
  optionRow: { minHeight: 75, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8F0E8', marginLeft: 48 },
  errorText: { color: '#B3261E', fontSize: 13, marginTop: 12 },
  successText: { color: '#2E7D32', fontSize: 13, marginTop: 12 },
});
