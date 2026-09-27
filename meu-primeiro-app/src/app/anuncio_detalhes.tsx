import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../config/api';

const { width } = Dimensions.get('window');

interface DetalheAnuncio {
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
  vendedor_email: string;
  vendedor_tipo: string;
  cidade: string | null;
  estado: string | null;
  imagens: string[];
}

export default function DetalhesAnuncioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idAnuncio = params.id;

  const [anuncio, setAnuncio] = useState<DetalheAnuncio | null>(null);
  const [loading, setLoading] = useState(true);
  const [imagemAtiva, setImagemAtiva] = useState(0);

  const carregarDetalhes = useCallback(async () => {
    if (!idAnuncio) return;

    try {
      const response = await fetch(`${API_BASE_URL}/anuncios/${idAnuncio}`);
      if (response.ok) {
        const data = await response.json();
        setAnuncio(data);
      } else {
        Alert.alert('Erro', 'Anúncio não encontrado.');
        router.back();
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do anúncio:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  }, [idAnuncio, router]);

  useEffect(() => {
    carregarDetalhes();
  }, [carregarDetalhes]);

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

  const dataFormatada = anuncio?.criado_em
    ? new Date(anuncio.criado_em).toLocaleDateString('pt-BR')
    : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Carregando detalhes do anúncio...</Text>
      </SafeAreaView>
    );
  }

  if (!anuncio) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {anuncio.anuncio_titulo}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.galleryContainer}>
          {anuncio.imagens && anuncio.imagens.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const slide = Math.ceil(
                  e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
                );
                if (slide !== imagemAtiva) setImagemAtiva(slide);
              }}
              scrollEventThrottle={16}
            >
              {anuncio.imagens.map((img, index) => (
                <Image key={index} source={{ uri: img }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.placeholderGallery}>
              <MaterialCommunityIcons
                name={getCategoryIcon(anuncio.categoria)}
                size={70}
                color="#2E7D32"
              />
            </View>
          )}

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{anuncio.categoria}</Text>
          </View>

          {anuncio.imagens && anuncio.imagens.length > 1 && (
            <View style={styles.paginationDots}>
              {anuncio.imagens.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === imagemAtiva && styles.activeDot]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Valor do lote</Text>
              <Text style={styles.priceValue}>
                R$ {Number(anuncio.preco).toFixed(2).replace('.', ',')}
              </Text>
            </View>

            <View style={styles.quantityBadge}>
              <MaterialCommunityIcons name="weight" size={18} color="#2E7D32" />
              <Text style={styles.quantityText}>
                {Number(anuncio.quantidade)} {anuncio.unidade_medida}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{anuncio.anuncio_titulo}</Text>
          <Text style={styles.dateText}>Publicado em {dataFormatada}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>Especificações do Material</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Material</Text>
                <Text style={styles.infoValue}>{anuncio.material_nome}</Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Categoria</Text>
                <Text style={styles.infoValue}>{anuncio.categoria}</Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Quantidade Total</Text>
                <Text style={styles.infoValue}>
                  {Number(anuncio.quantidade)} {anuncio.unidade_medida}
                </Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: anuncio.status === 'ativo' ? '#2E7D32' : '#D32F2F' },
                  ]}
                >
                  {anuncio.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>Descrição do Anúncio</Text>
            <Text style={styles.descriptionText}>
              {anuncio.descricao || 'Nenhuma descrição detalhada foi informada pelo anunciante.'}
            </Text>
          </View>

          <View style={styles.sellerCard}>
            <View style={styles.sellerAvatar}>
              <MaterialCommunityIcons name="account" size={32} color="#2E7D32" />
            </View>

            <View style={styles.sellerDetails}>
              <Text style={styles.sellerName}>{anuncio.vendedor_nome}</Text>
              <Text style={styles.sellerLocation}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color="#666" />{' '}
                {anuncio.cidade && anuncio.estado
                  ? `${anuncio.cidade} - ${anuncio.estado}`
                  : 'Localização não informada'}
              </Text>
              {anuncio.vendedor_tipo ? (
                <Text style={styles.sellerType}>{anuncio.vendedor_tipo.toUpperCase()}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => router.push('/chat')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="message-text-outline" size={22} color="#FFF" />
          <Text style={styles.chatButtonText}>Conversar com o Vendedor</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F9F4' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#F4F9F4', gap: 12 },
  backButton: { padding: 8, borderRadius: 8, backgroundColor: '#E8F5E9' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  scrollContent: { paddingBottom: 100 },
  galleryContainer: { width: width, height: 240, backgroundColor: '#E8F5E9', position: 'relative' },
  galleryImage: { width: width, height: 240, resizeMode: 'cover' },
  placeholderGallery: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  categoryBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(27, 94, 32, 0.9)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  categoryBadgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  paginationDots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  activeDot: { backgroundColor: '#FFF', width: 20 },
  body: { padding: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  priceLabel: { fontSize: 13, color: '#666' },
  priceValue: { fontSize: 28, fontWeight: 'bold', color: '#1B5E20' },
  quantityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F5E9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  quantityText: { fontSize: 15, fontWeight: 'bold', color: '#2E7D32' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1B241D', marginBottom: 4 },
  dateText: { fontSize: 12, color: '#888', marginBottom: 20 },
  infoCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E8F5E9' },
  cardSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1B5E20', marginBottom: 12 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  infoItem: { width: '45%' },
  infoLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1B241D' },
  descriptionText: { fontSize: 14, color: '#444', lineHeight: 22 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: '#E8F5E9' },
  sellerAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  sellerDetails: { flex: 1 },
  sellerName: { fontSize: 16, fontWeight: 'bold', color: '#1B241D' },
  sellerLocation: { fontSize: 13, color: '#666', marginTop: 2 },
  sellerType: { fontSize: 11, fontWeight: 'bold', color: '#2E7D32', marginTop: 4 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E8F5E9', elevation: 8 },
  chatButton: { backgroundColor: '#2E7D32', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  chatButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});