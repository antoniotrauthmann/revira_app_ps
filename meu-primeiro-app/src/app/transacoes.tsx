import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, SafeAreaView,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

interface Transacao {
  id_transacao: number;
  id_anuncio: number;
  anuncio_titulo: string;
  material_nome: string;
  unidade_medida: string;
  quantidade: number | null;
  valor_total: number;
  endereco: string | null;
  data_hora: string | null;
  status: string;
  id_comprador: number;
  id_vendedor: number;
  comprador_nome: string;
  vendedor_nome: string;
  ja_avaliei: number;
}

const COR_STATUS: Record<string, string> = {
  pendente: '#F57F17',
  confirmada: '#1565C0',
  em_transporte: '#6A1B9A',
  concluida: '#2E7D32',
  cancelada: '#D32F2F',
};

const TEXTO_STATUS: Record<string, string> = {
  pendente: 'PENDENTE',
  confirmada: 'CONFIRMADA',
  em_transporte: 'EM TRANSPORTE',
  concluida: 'CONCLUÍDA',
  cancelada: 'CANCELADA',
};

export default function TransacoesScreen() {
  const router = useRouter();
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const avisar = (titulo: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${titulo}\n${msg}`);
    else Alert.alert(titulo, msg);
  };

  const confirmar = (titulo: string, msg: string, onOk: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${titulo}\n${msg}`)) onOk();
    } else {
      Alert.alert(titulo, msg, [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Confirmar', onPress: onOk },
      ]);
    }
  };

  const carregar = async () => {
    try {
      const salvo = await AsyncStorage.getItem('@usuario_logado');
      if (!salvo) return;
      const { id_usuario } = JSON.parse(salvo);
      setUserId(id_usuario);
      const r = await fetch(`${API_BASE_URL}/transacoes?id_usuario=${id_usuario}`);
      if (r.ok) setTransacoes(await r.json());
    } catch (e) {
      console.error('Erro ao carregar transações:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const mudarStatus = async (id: number, status: 'concluida' | 'cancelada') => {
    if (!userId) return;
    try {
      const r = await fetch(`${API_BASE_URL}/transacoes/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: userId, status }),
      });
      const resp = await r.json();
      avisar(r.ok ? 'Pronto' : 'Atenção', resp.mensagem);
      carregar();
    } catch (e) {
      avisar('Erro', 'Erro ao conectar com o servidor.');
    }
  };

  const formatarDataHora = (s: string | null) => {
    if (!s) return '-';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '-';
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderItem = ({ item }: { item: Transacao }) => {
    const souVendedor = Number(item.id_vendedor) === Number(userId);
    const outroNome = souVendedor ? item.comprador_nome : item.vendedor_nome;
    const emAndamento = ['pendente', 'confirmada', 'em_transporte'].includes(item.status);
    const jaPodeConcluir = item.data_hora ? new Date(item.data_hora) <= new Date() : true;

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.titulo} numberOfLines={1}>{item.anuncio_titulo}</Text>
          <Text style={[styles.status, { color: COR_STATUS[item.status] }]}>
            {TEXTO_STATUS[item.status] || item.status}
          </Text>
        </View>

        <Text style={styles.papel}>
          {souVendedor ? 'Você vendeu para' : 'Você comprou de'}{' '}
          <Text style={styles.valor}>{outroNome}</Text>
        </Text>

        <Text style={styles.linha}>Material: <Text style={styles.valor}>{item.material_nome}</Text></Text>
        {item.quantidade != null && (
          <Text style={styles.linha}>Quantidade: <Text style={styles.valor}>{Number(item.quantidade)} {item.unidade_medida}</Text></Text>
        )}
        <Text style={styles.linha}>Local: <Text style={styles.valor}>{item.endereco || '-'}</Text></Text>
        <Text style={styles.linha}>Quando: <Text style={styles.valor}>{formatarDataHora(item.data_hora)}</Text></Text>
        <Text style={styles.total}>R$ {Number(item.valor_total).toFixed(2).replace('.', ',')}</Text>

        {emAndamento && (
          <View style={styles.botoes}>
            <TouchableOpacity
              style={styles.btnCancelar}
              onPress={() => confirmar('Cancelar transação?', 'Essa ação não pode ser desfeita.', () => mudarStatus(item.id_transacao, 'cancelada'))}
            >
              <Text style={styles.btnCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
                        {jaPodeConcluir && (
              <TouchableOpacity
                style={styles.btnConcluir}
                onPress={() => confirmar('Concluir transação?', 'Confirme que a entrega/retirada foi feita.', () => mudarStatus(item.id_transacao, 'concluida'))}
              >
                <Text style={styles.btnConcluirTexto}>Concluir</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {item.status === 'concluida' && item.ja_avaliei ? (
          <Text style={{ marginTop: 12, textAlign: 'center', color: '#2E7D32', fontWeight: '600' }}>
            ✓ Você já avaliou
          </Text>
        ) : null}
        {item.status === 'concluida' && !item.ja_avaliei && (
          <TouchableOpacity
  style={styles.btnAvaliar}
  onPress={() =>
    router.push({
      pathname: '/avaliacao',
      params: {
        id_transacao: item.id_transacao,
        id_avaliado: souVendedor ? item.id_comprador : item.id_vendedor,
      },
    } as any)
  }
>
            <MaterialCommunityIcons name="star" size={18} color="#F9A825" />
            <Text style={styles.btnAvaliarTexto}>Avaliar</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/home')}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas transações</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2E7D32" />
      ) : (
        <FlatList
          data={transacoes}
          keyExtractor={(t) => String(t.id_transacao)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={['#2E7D32']} />
          }
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma transação ainda.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backButton: { padding: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#E8F5E9' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1B5E20' },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8F5E9' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  titulo: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1B241D' },
  status: { fontSize: 11, fontWeight: 'bold' },
  papel: { fontSize: 13, color: '#666', marginBottom: 8 },
  linha: { fontSize: 13, color: '#666', marginBottom: 3 },
  valor: { color: '#1B241D', fontWeight: '600' },
  total: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20', marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnConcluir: { flex: 1, backgroundColor: '#2E7D32', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnConcluirTexto: { color: '#FFF', fontWeight: 'bold' },
  btnCancelar: { flex: 1, borderWidth: 1, borderColor: '#D32F2F', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnCancelarTexto: { color: '#D32F2F', fontWeight: 'bold' },
  btnAvaliar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#F9A825', backgroundColor: '#FFFDE7' },
  btnAvaliarTexto: { color: '#F57F17', fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});