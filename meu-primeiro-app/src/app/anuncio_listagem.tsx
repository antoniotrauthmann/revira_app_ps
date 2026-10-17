import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
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
  const { width } = useWindowDimensions();

  // Estados originais mantidos
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todos');

  // Estado interativo para Favoritos
  const [favoritos, setFavoritos] = useState<number[]>([]);

  // Cálculo de colunas responsivas para Celular vs Desktop
  const numColumns = useMemo(() => {
    if (width >= 1200) return 4;
    if (width >= 800) return 3;
    if (width >= 600) return 2;
    return 1;
  }, [width]);

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

  const toggleFavorito = (id: number) => {
    setFavoritos((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
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

  const renderItem = ({ item }: { item: Anuncio }) => {
    const isFavorito = favoritos.includes(item.id_anuncio);

    return (
      <View style={[styles.cardWrapper, { width: numColumns > 1 ? `${100 / numColumns}%` : '100%' }]}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.9}
          onPress={() => router.push({ pathname: '/anuncio_detalhes', params: { id: item.id_anuncio } })}
        >
          {/* Imagem do Produto + Badges */}
          <View style={styles.imageContainer}>
            {item.imagem_capa ? (
              <Image source={{ uri: item.imagem_capa }} style={styles.cardImage} />
            ) : (
              <View style={styles.placeholderImage}>
                <MaterialCommunityIcons
                  name={getCategoryIcon(item.categoria)}
                  size={52}
                  color="#16A34A"
                />
              </View>
            )}

            {/* Badge de Categoria */}
            <View style={styles.categoryBadge}>
              <MaterialCommunityIcons name={getCategoryIcon(item.categoria)} size={12} color="#FFF" />
              <Text style={styles.categoryBadgeText}>{item.categoria}</Text>
            </View>

            {/* Botão Favoritar */}
            <TouchableOpacity
              style={styles.favoriteButton}
              activeOpacity={0.8}
              onPress={() => toggleFavorito(item.id_anuncio)}
            >
              <MaterialCommunityIcons
                name={isFavorito ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorito ? '#EF4444' : '#475569'}
              />
            </TouchableOpacity>
          </View>

          {/* Corpo do Card */}
          <View style={styles.cardBody}>
            {/* Título */}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.anuncio_titulo}
            </Text>

            {/* Tag de Material */}
            <View style={styles.materialRow}>
              <Text style={styles.materialLabel}>Material:</Text>
              <View style={styles.materialBadge}>
                <Text style={styles.materialBadgeText} numberOfLines={1}>
                  {item.material_nome}
                </Text>
              </View>
            </View>

            {/* Quantidade e Preço */}
            <View style={styles.infoRow}>
              <View style={styles.qtdTag}>
                <MaterialCommunityIcons name="scale-balance" size={14} color="#059669" />
                <Text style={styles.qtdText}>
                  {Number(item.quantidade)} {item.unidade_medida}
                </Text>
              </View>

              <Text style={styles.priceText}>
                R$ {Number(item.preco).toFixed(2).replace('.', ',')}
              </Text>
            </View>

            {/* Informações do Vendedor */}
            <View style={styles.sellerRow}>
              <View style={styles.sellerInfo}>
                <View style={styles.sellerAvatar}>
                  <Text style={styles.sellerAvatarText}>
                    {item.vendedor_nome ? item.vendedor_nome.charAt(0).toUpperCase() : 'V'}
                  </Text>
                </View>

                <View style={styles.sellerDetails}>
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {item.vendedor_nome}
                  </Text>
                  <View style={styles.ratingContainer}>
                    <MaterialCommunityIcons name="star" size={12} color="#F59E0B" />
                    <Text style={styles.ratingText}>5.0</Text>
                  </View>
                </View>
              </View>

              {/* Botão Contato */}
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => router.push('/chat')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="message-text-outline" size={14} color="#FFF" />
                <Text style={styles.chatButtonText}>Contato</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainContent}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/home')}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#16A34A" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Explorar Produtos</Text>
            <Text style={styles.headerSubtitle}>
              {anunciosFiltrados.length} {anunciosFiltrados.length === 1 ? 'item sustentável' : 'itens sustentáveis'}
            </Text>
          </View>
        </View>

        {/* Campo de Busca */}
        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={22} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por título, material ou vendedor..."
            placeholderTextColor="#94A3B8"
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Carrossel de Categorias */}
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
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={getCategoryIcon(item)}
                    size={16}
                    color={selected ? '#FFF' : '#64748B'}
                  />
                  <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Lista de Produtos */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#16A34A" />
            <Text style={styles.loadingText}>Buscando produtos ecológicos...</Text>
          </View>
        ) : (
          <FlatList
            key={numColumns}
            data={anunciosFiltrados}
            keyExtractor={(item) => item.id_anuncio.toString()}
            renderItem={renderItem}
            numColumns={numColumns}
            contentContainerStyle={styles.listContainer}
            columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16A34A']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <MaterialCommunityIcons name="leaf-off" size={48} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>Nenhum produto encontrado</Text>
                <Text style={styles.emptySubtitle}>
                  Tente ajustar sua busca ou mudar o filtro de categorias.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mainContent: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 18 : 12,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.03)',
      },
    }),
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  categoriesWrapper: {
    marginBottom: 20,
  },
  categoriesList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipSelected: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 4,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: 20,
  },
  cardWrapper: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.06)',
      },
    }),
  },
  imageContainer: {
    height: 170,
    width: '100%',
    backgroundColor: '#F1F5F9',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#F0FDF4',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(22, 163, 74, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
    lineHeight: 22,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  materialLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  materialBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    maxWidth: '75%',
  },
  materialBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  qtdTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  qtdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  sellerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16A34A',
  },
  sellerDetails: {
    flex: 1,
  },
  sellerName: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  ratingText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 300,
  },
});