import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

interface AvaliacaoItem {
  id_avaliacao: number;
  nota: number;
  comentario: string | null;
  criado_em: string;
  avaliador_nome?: string;
  avaliado_nome?: string;
}

interface TransacaoPendente {
  id_transacao: number;
  criado_em: string;
  valor_total: number;
  anuncio_titulo: string;
  id_outro_usuario: number;
  outro_usuario_nome: string;
  outro_usuario_tipo: string;
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR');
}

export default function MinhasAvaliacoesScreen() {
  const router = useRouter();
  const [avaliacoesRecebidas, setAvaliacoesRecebidas] = useState<AvaliacaoItem[]>([]);
  const [avaliacoesFeitas, setAvaliacoesFeitas] = useState<AvaliacaoItem[]>([]);
  const [pendentes, setPendentes] = useState<TransacaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState('');

  const carregarAvaliacoes = useCallback(async (atualizacao = false) => {
    if (atualizacao) setRefreshing(true);
    else setLoading(true);
    setErro('');

    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
      if (!dadosSalvos) {
        router.replace('/');
        return;
      }
      const usuario = JSON.parse(dadosSalvos) as { id_usuario?: number };
      if (!usuario.id_usuario) {
        throw new Error('Não foi possível identificar o usuário logado.');
      }

      const [recebidasResponse, feitasResponse, pendentesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/usuarios/${usuario.id_usuario}/avaliacoes/recebidas`),
        fetch(`${API_BASE_URL}/usuarios/${usuario.id_usuario}/avaliacoes/feitas`),
        fetch(`${API_BASE_URL}/usuarios/${usuario.id_usuario}/avaliacoes/pendentes`),
      ]);

      if (!recebidasResponse.ok || !feitasResponse.ok || !pendentesResponse.ok) {
        throw new Error('Não foi possível carregar suas avaliações. Tente novamente.');
      }

      const [recebidas, feitas, transacoesPendentes] = await Promise.all([
        recebidasResponse.json(),
        feitasResponse.json(),
        pendentesResponse.json(),
      ]);
      setAvaliacoesRecebidas(recebidas);
      setAvaliacoesFeitas(feitas);
      setPendentes(transacoesPendentes);
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      setErro(error instanceof Error ? error.message : 'Erro ao carregar avaliações.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      carregarAvaliacoes();
    }, [carregarAvaliacoes])
  );

  const abrirAvaliacao = (transacao: TransacaoPendente) => {
    router.push({
      pathname: '/avaliacao',
      params: {
        id_transacao: String(transacao.id_transacao),
        id_avaliado: String(transacao.id_outro_usuario),
        nome: transacao.outro_usuario_nome,
      },
    } as any);
  };

  const renderAvaliacao = (item: AvaliacaoItem, tipo: 'recebida' | 'feita') => (
    <View key={item.id_avaliacao} style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewer}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={20} color="#2E7D32" />
          </View>
          <View>
            <Text style={styles.reviewerName}>
              {tipo === 'recebida' ? item.avaliador_nome : item.avaliado_nome}
            </Text>
            <Text style={styles.reviewDate}>{formatarData(item.criado_em)}</Text>
          </View>
        </View>
        <View style={styles.ratingBadge}>
          <MaterialCommunityIcons name="star" size={15} color="#F9A825" />
          <Text style={styles.ratingText}>{item.nota}/5</Text>
        </View>
      </View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={star <= item.nota ? 'star' : 'star-outline'}
            size={17}
            color="#F9A825"
          />
        ))}
      </View>
      <Text style={styles.comment}>
        {item.comentario?.trim() || 'Nenhum comentário.'}
      </Text>
    </View>
  );

  const renderVazio = (mensagem: string) => (
    <View style={styles.emptySection}>
      <MaterialCommunityIcons name="star-outline" size={25} color="#9EAA9F" />
      <Text style={styles.emptyText}>{mensagem}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Carregando avaliações...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (router.canGoBack() ? router.back() : router.push('/home'))}
        accessibilityLabel="Voltar"
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
      </TouchableOpacity>

      {erro ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{erro}</Text>
          <TouchableOpacity onPress={() => carregarAvaliacoes()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => carregarAvaliacoes(true)}
              tintColor="#2E7D32"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>Minhas Avaliações</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Pendentes de avaliação</Text>
              <Text style={styles.sectionSubtitle}>
                Avalie quem participou das suas transações concluídas
              </Text>
            </View>
            {pendentes.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{pendentes.length}</Text>
              </View>
            )}
          </View>

          {pendentes.length ? (
            <FlatList
              data={pendentes}
              horizontal
              keyExtractor={(item) => String(item.id_transacao)}
              renderItem={({ item }) => (
                <View style={styles.pendingCard}>
                  <View style={styles.pendingIcon}>
                    <MaterialCommunityIcons name="recycle" size={22} color="#2E7D32" />
                  </View>
                  <Text style={styles.pendingTitle} numberOfLines={1}>
                    {item.anuncio_titulo}
                  </Text>
                  <Text style={styles.pendingPerson} numberOfLines={1}>
                    com {item.outro_usuario_nome}
                  </Text>
                  <Text style={styles.pendingDate}>{formatarData(item.criado_em)}</Text>
                  <TouchableOpacity
                    style={styles.evaluateButton}
                    onPress={() => abrirAvaliacao(item)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="star" size={17} color="#FFF" />
                    <Text style={styles.evaluateButtonText}>Avaliar</Text>
                  </TouchableOpacity>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
            />
          ) : (
            renderVazio('Não há transações concluídas aguardando sua avaliação.')
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Avaliações recebidas</Text>
                <Text style={styles.sectionSubtitle}>O que terceiros dizem sobre você</Text>
              </View>
              <MaterialCommunityIcons name="account-arrow-down" size={22} color="#2E7D32" />
            </View>
            {avaliacoesRecebidas.length
              ? avaliacoesRecebidas.map((item) => renderAvaliacao(item, 'recebida'))
              : renderVazio('Você ainda não recebeu avaliações.')}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Avaliações feitas</Text>
                <Text style={styles.sectionSubtitle}>Suas avaliações sobre outras pessoas</Text>
              </View>
              <MaterialCommunityIcons name="account-arrow-up" size={22} color="#2E7D32" />
            </View>
            {avaliacoesFeitas.length
              ? avaliacoesFeitas.map((item) => renderAvaliacao(item, 'feita'))
              : renderVazio('Você ainda não avaliou ninguém.')}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  backButton: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    top: Platform.OS === 'android' ? 40 : 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 12,
    backgroundColor: '#F4F9F4',
  },
  headerSpacer: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  section: { marginTop: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1B5E20' },
  sectionSubtitle: { color: '#718075', fontSize: 12, marginTop: 3 },
  countBadge: { backgroundColor: '#E8F5E9', minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#2E7D32', fontWeight: '700' },
  carousel: { paddingBottom: 2, gap: 12 },
  pendingCard: { width: 220, backgroundColor: '#FFF', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#E1EDE2' },
  pendingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  pendingTitle: { color: '#1B241D', fontSize: 15, fontWeight: '700' },
  pendingPerson: { color: '#526256', fontSize: 13, marginTop: 5 },
  pendingDate: { color: '#89948B', fontSize: 12, marginTop: 5 },
  evaluateButton: { marginTop: 13, backgroundColor: '#2E7D32', paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  evaluateButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  reviewCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#E8F5E9', marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewer: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  reviewerName: { color: '#1B241D', fontWeight: '700', fontSize: 14 },
  reviewDate: { color: '#89948B', fontSize: 11, marginTop: 2 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF8E1', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  ratingText: { color: '#66520A', fontSize: 12, fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 10 },
  comment: { color: '#4D5850', fontSize: 13, lineHeight: 19, marginTop: 7 },
  emptySection: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: '#EDF4ED', borderRadius: 13 },
  emptyText: { color: '#718075', fontSize: 12, flexShrink: 1 },
  errorBox: { margin: 20, padding: 16, backgroundColor: '#FFF3F0', borderRadius: 12, alignItems: 'center' },
  errorText: { color: '#B3261E', textAlign: 'center' },
  retryText: { color: '#1B5E20', fontWeight: '700', marginTop: 12 },
});
