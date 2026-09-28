import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../config/api';

interface AvaliacaoItem {
  id_avaliacao: number;
  nota: number;
  comentario: string;
  criado_em: string;
  avaliador_nome: string;
}

export default function MinhasAvaliacoesScreen() {
  const router = useRouter();
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ID do utilizador logado atual (vamos assumir o ID 1, que é o seu utilizador de testes)
  const idUsuarioLogado = 1;

  useEffect(() => {
    carregarAvaliacoes();
  }, []);

  const carregarAvaliacoes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${idUsuarioLogado}/avaliacoes`);
      if (response.ok) {
        const data = await response.json();
        setAvaliacoes(data);
      }
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: AvaliacaoItem }) => {
    const dataFormatada = new Date(item.criado_em).toLocaleDateString('pt-BR');
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <MaterialCommunityIcons name="account-circle" size={24} color="#2E7D32" />
            <Text style={styles.userName}>{item.avaliador_nome || 'Utilizador'}</Text>
          </View>
          <Text style={styles.dateText}>{dataFormatada}</Text>
        </View>

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <MaterialCommunityIcons
              key={star}
              name={star <= item.nota ? "star" : "star-outline"}
              size={18}
              color="#FFD700"
            />
          ))}
          <Text style={styles.notaNumber}>({item.nota}/5)</Text>
        </View>

        <Text style={styles.comentarioText}>
          {item.comentario || 'Nenhum comentário deixado pelo avaliador.'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/home');
            }
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas Avaliações</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>A carregar avaliações...</Text>
        </View>
      ) : (
        <FlatList
          data={avaliacoes}
          keyExtractor={(item) => item.id_avaliacao.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="star-outline" size={60} color="#BDBDBD" />
              <Text style={styles.emptyTitle}>Ainda não tem avaliações</Text>
              <Text style={styles.emptySubtitle}>
                As avaliações recebidas nas suas transações aparecerão aqui.
              </Text>
            </View>
          }
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  listContainer: { padding: 20, gap: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E8F5E9', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 15, fontWeight: 'bold', color: '#1B241D' },
  dateText: { fontSize: 12, color: '#888' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  notaNumber: { fontSize: 13, fontWeight: '600', color: '#666', marginLeft: 4 },
  comentarioText: { fontSize: 14, color: '#444', lineHeight: 20 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
});