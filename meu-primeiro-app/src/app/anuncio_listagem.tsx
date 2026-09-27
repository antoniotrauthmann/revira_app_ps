import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../config/api';

interface Anuncio {
  id_anuncio: number;
  anuncio_titulo: string;
  descricao: string;
  quantidade: number;
  preco: number;
  status: string;
  criado_em: string;
  material_nome: string;
  categoria: string;
  unidade_medida: string;
  id_usuario: number;
  vendedor_nome: string;
  imagem_capa: string | null;
}

const CATEGORIAS_FILTRO = ['Todos', 'Papel', 'Plástico', 'Vidro', 'Metal', 'Eletrônicos'];

export default function AnunciosScreen() {
  const router = useRouter();
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todos');

  const carregarAnuncios = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/anuncios`);
      if (response.ok) {
        const data = await response.json();
        setAnuncios(data);
      } else {
        console.error('Erro ao buscar anúncios');
      }
    } catch (error) {
      console.error('Erro na conexão com a API:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregarAnuncios();
  }, [carregarAnuncios]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarAnuncios();
  };

  const getCategoryIcon = (categoria: string) => {
    switch (categoria?.toLowerCase()) {
      case 'papel':
        return 'file-document-outline';
      case 'plástico':
      case 'plastico':
        return 'bottle-soda-outline';
      case 'vidro':
        return 'glass-fragile';
      case 'metal':
        return 'cog-outline';
      case 'eletrônicos':
      case 'eletronicos':
        return 'power-plug-outline';
      default:
        return 'recycle';
    }
  };

  const anunciosFiltrados = anuncios.filter((item) => {
    const bateCategoria =
      categoriaSelecionada === 'Todos' ||
      item.categoria.toLowerCase() === categoriaSelecionada.toLowerCase();

    const termo = busca.toLowerCase();
    const bateBusca =
      item.anuncio_titulo.toLowerCase().includes(termo) ||
      item.material_nome.toLowerCase().includes(termo) ||
      item.vendedor_nome.toLowerCase().includes(termo);

    return bateCategoria && bateBusca;
  });

  const renderItem = ({ item }: { item: Anuncio }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/anuncio_detalhes', params: { id: item.id_anuncio } })}
    >
      <View style={styles.imageContainer}>
        {item.imagem_capa ? (
          <Image source={{ uri: item.imagem_capa }} style={styles.cardImage} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialCommunityIcons
              name={getCategoryIcon(item.categoria)}
              size={42}
              color="#2E7D32"
            />
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.categoria}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.anuncio_titulo}
        </Text>

        <Text style={styles.materialText}>
          Material: <Text style={styles.materialHighlight}>{item.material_nome}</Text>
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.qtdTag}>
            <MaterialCommunityIcons name="weight" size={14} color="#666" />
            <Text style={styles.qtdText}>
              {Number(item.quantidade)} {item.unidade_medida}
            </Text>
          </View>

          <Text style={styles.priceText}>
            R$ {Number(item.preco).toFixed(2).replace('.', ',')}
          </Text>
        </View>

        <View style={styles.sellerRow}>
          <View style={styles.sellerInfo}>
            <MaterialCommunityIcons name="account-circle-outline" size={16} color="#666" />
            <Text style={styles.sellerName} numberOfLines={1}>
              {item.vendedor_nome}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => router.push('/chat')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="message-text-outline" size={16} color="#FFF" />
            <Text style={styles.chatButtonText}>Contato</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/home')}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anúncios Disponíveis</Text>
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título, material ou vendedor..."
          placeholderTextColor="#999"
          value={busca}
          onChangeText={setBusca}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIAS_FILTRO}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const selected = categoriaSelecionada === item;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                onPress={() => setCategoriaSelecionada(item)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selected && styles.categoryChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Carregando anúncios...</Text>
        </View>
      ) : (
        <FlatList
          data={anunciosFiltrados}
          keyExtractor={(item) => item.id_anuncio.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="package-variant" size={60} color="#BDBDBD" />
              <Text style={styles.emptyTitle}>Nenhum anúncio encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Tente mudar os filtros de categoria ou o termo da busca.
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E8F5E9' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1B241D' },
  categoriesWrapper: { marginBottom: 12 },
  categoriesList: { paddingHorizontal: 20, gap: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8F5E9' },
  categoryChipSelected: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  categoryChipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  categoryChipTextSelected: { color: '#FFF', fontWeight: 'bold' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E8F5E9', elevation: 2 },
  imageContainer: { height: 140, width: '100%', backgroundColor: '#F1F7EE', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { alignItems: 'center', justifyContent: 'center' },
  categoryBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(27, 94, 32, 0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  categoryBadgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  cardBody: { padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#1B241D', marginBottom: 4 },
  materialText: { fontSize: 13, color: '#666', marginBottom: 12 },
  materialHighlight: { fontWeight: '600', color: '#2E7D32' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  qtdTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F9F4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  qtdText: { fontSize: 13, fontWeight: '600', color: '#555' },
  priceText: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  sellerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F4F0' },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  sellerName: { fontSize: 13, color: '#666', fontWeight: '500', flex: 1 },
  chatButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2E7D32', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  chatButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#555', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 4 },
});