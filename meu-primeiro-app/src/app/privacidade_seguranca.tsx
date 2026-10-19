import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { clearSessionToken, getSessionToken } from '../config/session';

interface SessaoUsuario {
  id_sessao: number;
  dispositivo: string;
  criado_em: string;
  ultimo_acesso: string;
  expira_em: string;
  atual: boolean | 0 | 1;
}

function formatarData(data: string) {
  const valor = new Date(data.replace(' ', 'T'));
  return Number.isNaN(valor.getTime())
    ? data
    : valor.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function PrivacidadeSegurancaScreen() {
  const router = useRouter();
  const [sessoes, setSessoes] = useState<SessaoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sessaoToken, setSessaoToken] = useState('');
  const [deletingSession, setDeletingSession] = useState<number | null>(null);
  const [modalExclusao, setModalExclusao] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erroExclusao, setErroExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const carregarSessoes = useCallback(async (atualizar = false) => {
    if (atualizar) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const token = await getSessionToken();
      if (!token) {
        await AsyncStorage.removeItem('@usuario_logado');
        router.replace('/');
        return;
      }
      setSessaoToken(token);

      const response = await fetch(`${API_BASE_URL}/usuario/sessoes/ativas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        await AsyncStorage.removeItem('@usuario_logado');
        await clearSessionToken();
        router.replace('/');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.mensagem || 'Não foi possível carregar os dispositivos conectados.');
      }
      setSessoes(await response.json());
    } catch (loadError) {
      console.error('Erro ao carregar sessões:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar sessões.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void carregarSessoes();
    }, [carregarSessoes])
  );

  const encerrarSessao = async (sessao: SessaoUsuario) => {
    const confirmar = async () => {
      setDeletingSession(sessao.id_sessao);
      try {
        const response = await fetch(
          `${API_BASE_URL}/usuario/sessoes/${sessao.id_sessao}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${sessaoToken}` } }
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.mensagem || 'Não foi possível encerrar a sessão.');
        setSessoes((atuais) => atuais.filter((item) => item.id_sessao !== sessao.id_sessao));
      } catch (revokeError) {
        console.error('Erro ao encerrar sessão remota:', revokeError);
        const mensagem = revokeError instanceof Error ? revokeError.message : 'Erro ao encerrar sessão.';
        if (Platform.OS === 'web') window.alert(mensagem);
        else Alert.alert('Erro', mensagem);
      } finally {
        setDeletingSession(null);
      }
    };

    const mensagem = `Encerrar a sessão em ${sessao.dispositivo}?`;
    if (Platform.OS === 'web') {
      if (window.confirm(mensagem)) await confirmar();
    } else {
      Alert.alert('Encerrar sessão', mensagem, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: () => void confirmar() },
      ]);
    }
  };

  const apagarConta = async () => {
    setErroExclusao('');
    if (!senha) {
      setErroExclusao('Informe sua senha atual.');
      return;
    }
    if (confirmacao.trim().toUpperCase() !== 'APAGAR') {
      setErroExclusao('Digite APAGAR para confirmar.');
      return;
    }

    setExcluindo(true);
    try {
      const response = await fetch(`${API_BASE_URL}/usuario/conta`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessaoToken}`,
        },
        body: JSON.stringify({ senha }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.mensagem || 'Não foi possível apagar a conta.');

      await AsyncStorage.removeItem('@usuario_logado');
      await clearSessionToken();
      setModalExclusao(false);
      router.replace('/');
      if (Platform.OS === 'web') window.alert(body.mensagem);
    } catch (deleteError) {
      console.error('Erro ao apagar conta:', deleteError);
      setErroExclusao(deleteError instanceof Error ? deleteError.message : 'Erro ao apagar a conta.');
    } finally {
      setExcluindo(false);
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
          <Text style={styles.mutedText}>Carregando segurança da conta...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void carregarSessoes(true)}
              tintColor="#2E7D32"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.headerSpacer} />
            <Text style={styles.title}>Privacidade e Segurança</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <MaterialCommunityIcons name="shield-check" size={26} color="#2E7D32" />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introTitle}>Sua conta, sob seu controle</Text>
              <Text style={styles.introText}>
                Confira onde sua conta está conectada e encerre sessões que não reconhecer.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Sessões e dispositivos</Text>
              <Text style={styles.sectionSubtitle}>
                {sessoes.length} {sessoes.length === 1 ? 'sessão ativa' : 'sessões ativas'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => void carregarSessoes(true)}
              accessibilityLabel="Atualizar sessões"
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#2E7D32" />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => void carregarSessoes()}>
                <Text style={styles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : sessoes.length ? (
            sessoes.map((sessao) => {
              const atual = sessao.atual === true || Number(sessao.atual) === 1;
              return (
                <View key={sessao.id_sessao} style={styles.sessionCard}>
                  <View style={styles.deviceIcon}>
                    <MaterialCommunityIcons
                      name={sessao.dispositivo.toLowerCase().includes('ios') ||
                        sessao.dispositivo.toLowerCase().includes('android')
                        ? 'cellphone'
                        : 'laptop'}
                      size={22}
                      color="#2E7D32"
                    />
                  </View>
                  <View style={styles.sessionInfo}>
                    <View style={styles.deviceNameRow}>
                      <Text style={styles.deviceName} numberOfLines={1}>{sessao.dispositivo}</Text>
                      {atual && <Text style={styles.currentBadge}>Este dispositivo</Text>}
                    </View>
                    <Text style={styles.sessionDate}>Último acesso: {formatarData(sessao.ultimo_acesso)}</Text>
                    <Text style={styles.sessionDate}>Conectado em: {formatarData(sessao.criado_em)}</Text>
                  </View>
                  {!atual && (
                    <TouchableOpacity
                      style={styles.revokeButton}
                      onPress={() => void encerrarSessao(sessao)}
                      disabled={deletingSession === sessao.id_sessao}
                      accessibilityLabel={`Encerrar sessão em ${sessao.dispositivo}`}
                    >
                      {deletingSession === sessao.id_sessao
                        ? <ActivityIndicator size="small" color="#C62828" />
                        : <MaterialCommunityIcons name="logout" size={20} color="#C62828" />}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="devices" size={26} color="#87958A" />
              <Text style={styles.mutedText}>Nenhuma sessão ativa foi encontrada.</Text>
            </View>
          )}

          <View style={styles.dangerSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.dangerTitle}>Apagar conta</Text>
              </View>
              <MaterialCommunityIcons name="account-remove-outline" size={23} color="#B3261E" />
            </View>
            <Text style={styles.dangerDescription}>
              Seus dados pessoais serão removidos, seus anúncios serão desativados e todas as
              sessões serão encerradas. Registros necessários do marketplace poderão ser mantidos
              sem identificação pessoal.
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                setSenha('');
                setConfirmacao('');
                setErroExclusao('');
                setModalExclusao(true);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="delete-outline" size={20} color="#FFF" />
              <Text style={styles.deleteButtonText}>Apagar minha conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <Modal
        visible={modalExclusao}
        transparent
        animationType="fade"
        onRequestClose={() => setModalExclusao(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <MaterialCommunityIcons name="alert-outline" size={26} color="#B3261E" />
            </View>
            <Text style={styles.modalTitle}>Confirmar exclusão da conta</Text>
            <Text style={styles.modalText}>
              Esta ação não pode ser desfeita. Confirme sua senha e digite APAGAR.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Senha atual"
              placeholderTextColor="#89948B"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoCapitalize="none"
              editable={!excluindo}
            />
            <TextInput
              style={styles.input}
              placeholder="Digite APAGAR"
              placeholderTextColor="#89948B"
              value={confirmacao}
              onChangeText={setConfirmacao}
              autoCapitalize="characters"
              editable={!excluindo}
            />
            {erroExclusao ? <Text style={styles.errorText}>{erroExclusao}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalExclusao(false)}
                disabled={excluindo}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={() => void apagarConta()}
                disabled={excluindo}
              >
                {excluindo
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.confirmDeleteText}>Apagar conta</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  mutedText: { color: '#718075', fontSize: 13 },
  introCard: {
    flexDirection: 'row', gap: 13, alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E8F5E9', marginBottom: 24,
  },
  introIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1 },
  introTitle: { fontSize: 15, fontWeight: '700', color: '#1B5E20' },
  introText: { fontSize: 12, lineHeight: 17, color: '#718075', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1B5E20' },
  sectionSubtitle: { color: '#718075', fontSize: 12, marginTop: 3 },
  refreshButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  sessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10,
    backgroundColor: '#FFF', borderRadius: 15, borderWidth: 1, borderColor: '#E8F5E9',
  },
  deviceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  sessionInfo: { flex: 1 },
  deviceNameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  deviceName: { color: '#1B241D', fontWeight: '700', fontSize: 14, flexShrink: 1 },
  currentBadge: { color: '#2E7D32', fontSize: 10, fontWeight: '700', backgroundColor: '#E8F5E9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  sessionDate: { color: '#718075', fontSize: 11, marginTop: 4 },
  revokeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center' },
  emptyCard: { minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#EDF4ED', borderRadius: 14 },
  errorCard: { backgroundColor: '#FFF1F0', padding: 14, borderRadius: 12 },
  errorText: { color: '#B3261E', fontSize: 13 },
  retryText: { color: '#1B5E20', fontWeight: '700', marginTop: 9 },
  dangerSection: { marginTop: 30, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F2D7D5', borderRadius: 18, padding: 16 },
  dangerTitle: { color: '#B3261E', fontSize: 17, fontWeight: '700' },
  dangerDescription: { color: '#6B5B5A', fontSize: 13, lineHeight: 19, marginBottom: 15 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#B3261E', padding: 13, borderRadius: 12 },
  deleteButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18, 32, 22, 0.48)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  modalCard: { width: '100%', maxWidth: 430, backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  modalIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 },
  modalTitle: { color: '#1B241D', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  modalText: { color: '#718075', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 16 },
  input: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#DDE8DE', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, color: '#1B241D', marginBottom: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 11, backgroundColor: '#EDF4ED' },
  cancelText: { color: '#39513D', fontWeight: '700' },
  confirmDeleteButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 11, backgroundColor: '#B3261E' },
  confirmDeleteText: { color: '#FFF', fontWeight: '700' },
});
