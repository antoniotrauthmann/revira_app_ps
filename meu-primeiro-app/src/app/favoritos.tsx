import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

interface AnuncioFavorito {
  id_anuncio: number;
  anuncio_titulo: string;
  descricao: string | null;
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

export default function FavoritosScreen() {
  const router = useRouter();
  const [favoritos, setFavoritos] = useState<AnuncioFavorito[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarFavoritos = useCallback(async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');

      if (!dadosSalvos) {
        router.replace('/');
        return;
      }

      const usuario = JSON.parse(dadosSalvos);
      const response = await fetch(`${API_BASE_URL}/favoritos/${usuario.id_usuario}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar favoritos');
      }

      const data = await response.json();
      setFavoritos(data);
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus favoritos no momento.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregarFavoritos();
  }, [carregarFavoritos]);

  const toggleFavorito = async (idAnuncio: number) => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');

      if (!dadosSalvos) {
        Alert.alert('Atenção', 'Faça login para gerenciar seus favoritos.');
        router.replace('/');
        return;
      }

      const usuario = JSON.parse(dadosSalvos);
      const response = await fetch(`${API_BASE_URL}/favoritos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_usuario: usuario.id_usuario,
          id_anuncio: idAnuncio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensagem || 'Não foi possível atualizar favorito.');
      }

      if (!data.favoritado) {
        setFavoritos((prev) => prev.filter((item) => item.id_anuncio !== idAnuncio));
      }
    } catch (error) {
      console.error('Erro ao atualizar favorito:', error);
      Alert.alert('Erro', 'Não foi possível atualizar esse anúncio nos favoritos.');
    }
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

  const renderItem = ({ item }: { item: AnuncioFavorito }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
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

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorito(item.id_anuncio)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="heart" size={18} color="#D32F2F" />
        </TouchableOpacity>

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.categoria}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.anuncio_titulo}</Text>

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
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Favoritos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Carregando favoritos...</Text>
        </View>
      ) : favoritos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="heart-broken-outline" size={56} color="#A5D6A7" />
          <Text style={styles.emptyTitle}>Você ainda não marcou favoritos</Text>
          <Text style={styles.emptyText}>
            Salve anúncios que você quiser acompanhar e veja tudo aqui.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/anuncio_listagem')}>
            <Text style={styles.primaryButtonText}>Ver anúncios</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favoritos}
          keyExtractor={(item) => item.id_anuncio.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8F5E9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  imageContainer: {
    height: 180,
    position: 'relative',
    backgroundColor: '#E8F5E9',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(27,94,32,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardBody: {
    padding: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1B241D',
    marginBottom: 8,
  },
  materialText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  materialHighlight: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtdTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  qtdText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  sellerRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  sellerName: {
    fontSize: 13,
    color: '#666',
    maxWidth: '80%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
