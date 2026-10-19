import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, SafeAreaView,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

interface Conversa {
  id_anuncio: number;
  anuncio_titulo: string;
  id_outro: number;
  outro_nome: string;
  conteudo: string;
  url_imagem: string | null;
  id_proposta: number | null;
  enviado_em: string;
}

export default function ConversasScreen() {
  const router = useRouter();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const salvo = await AsyncStorage.getItem('@usuario_logado');
      if (!salvo) return;
      const { id_usuario } = JSON.parse(salvo);
      const r = await fetch(`${API_BASE_URL}/conversas?id_usuario=${id_usuario}`);
      if (r.ok) setConversas(await r.json());
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const resumo = (c: Conversa) => {
    if (c.id_proposta) return '🤝 Proposta de acordo';
    if (c.url_imagem && !c.conteudo) return '📷 Imagem';
    return c.conteudo;
  };

  const hora = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/home')}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas conversas</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#2E7D32" />
      ) : (
        <FlatList
          data={conversas}
          keyExtractor={(c) => `${c.id_anuncio}-${c.id_outro}`}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} colors={['#2E7D32']} />
          }
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma conversa ainda.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: { id_anuncio: item.id_anuncio, id_vendedor: item.id_outro },
                })
              }
            >
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="account" size={26} color="#2E7D32" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.outro_nome}</Text>
                <Text style={styles.anuncio} numberOfLines={1}>📦 {item.anuncio_titulo}</Text>
                <Text style={styles.msg} numberOfLines={1}>{resumo(item)}</Text>
              </View>
              <Text style={styles.data}>{hora(item.enviado_em)}</Text>
            </TouchableOpacity>
          )}
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8F5E9' },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  nome: { fontSize: 15, fontWeight: 'bold', color: '#1B241D' },
  anuncio: { fontSize: 12, color: '#2E7D32', marginTop: 2 },
  msg: { fontSize: 13, color: '#666', marginTop: 2 },
  data: { fontSize: 11, color: '#888' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
});