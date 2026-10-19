import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { API_BASE_URL } from '../config/api';

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

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // Layout em 2 colunas para Desktop/Web

  const [anuncio, setAnuncio] = useState<DetalheAnuncio | null>(null);
  const [loading, setLoading] = useState(true);
  const [imagemAtiva, setImagemAtiva] = useState(0);
  
  // Estados funcionais trazidos da branch 'develop'
  const [idUsuario, setIdUsuario] = useState<number | null>(null);
  const [comprando, setComprando] = useState(false);
  const [favoritado, setFavoritado] = useState(false);

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

  const carregarStatusFavorito = useCallback(async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
      if (!dadosSalvos || !idAnuncio) return;

      const usuario = JSON.parse(dadosSalvos);
      const response = await fetch(`${API_BASE_URL}/favoritos/${usuario.id_usuario}/${idAnuncio}`);

      if (response.ok) {
        const data = await response.json();
        setFavoritado(data.favoritado);
      }
    } catch (error) {
      console.error('Erro ao verificar favorito:', error);
    }
  }, [idAnuncio]);

  const toggleFavorito = async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');

      if (!dadosSalvos) {
        Alert.alert('Atenção', 'Faça login para salvar favoritos.');
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
        throw new Error(data.mensagem || 'Erro ao atualizar favorito');
      }

      setFavoritado(Boolean(data.favoritado));
    } catch (error) {
      console.error('Erro ao atualizar favorito:', error);
      Alert.alert('Erro', 'Não foi possível atualizar esse anúncio nos favoritos.');
    }
  };

  useEffect(() => {
    carregarDetalhes();
    carregarStatusFavorito();
  }, [carregarDetalhes, carregarStatusFavorito]);

  useEffect(() => {
    carregarUsuarioLogado();
  }, []);
  
  const carregarUsuarioLogado = async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
      if (dadosSalvos) {
        setIdUsuario(JSON.parse(dadosSalvos).id_usuario);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário logado:', error);
    }
  };
  
  const mostrarMensagem = (titulo: string, mensagem: string) => {
    if (Platform.OS === 'web') alert(mensagem);
    else Alert.alert(titulo, mensagem);
  };
  
  const criarTransacao = async () => {
    if (!idUsuario || !anuncio) return;
  
    setComprando(true);
  
    try {
      const response = await fetch(`${API_BASE_URL}/transacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_anuncio: anuncio.id_anuncio,
          id_comprador: idUsuario,
        }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        mostrarMensagem('Compra registrada', 'Agora agende a retirada na tela de coletas.');
        router.push('/coleta' as any);
      } else {
        mostrarMensagem('Erro', data.mensagem || 'Não foi possível registrar a compra.');
      }
    } catch (error) {
      console.error('Erro ao registrar compra:', error);
      mostrarMensagem('Erro de Conexão', 'Não foi possível conectar ao servidor.');
    } finally {
      setComprando(false);
    }
  };
  
  const handleComprar = () => {
    if (!anuncio) return;
  
    const pergunta = `Deseja comprar "${anuncio.anuncio_titulo}"?`;
  
    if (Platform.OS === 'web') {
      if (window.confirm(pergunta)) criarTransacao();
    } else {
      Alert.alert('Confirmar compra', pergunta, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Comprar', onPress: criarTransacao },
      ]);
    }
  };

  const getCategoryIcon = (categoria: string) => {
    switch (categoria?.toLowerCase()) {
      case 'papel':
      case 'papelão':
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
    ? new Date(anuncio.criado_em).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';
  
  const podeComprar =
    anuncio?.status === 'ativo' && idUsuario !== null && idUsuario !== anuncio.id_usuario;

  const handleCompartilhar = async () => {
    try {
      if (anuncio) {
        await Share.share({
          message: `Confira este lote sustentável no Revirapp: ${anuncio.anuncio_titulo} por R$ ${Number(anuncio.preco).toFixed(2).replace('.', ',')}`,
        });
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
    }
  };

  // Função para navegar até a página do vendedor
  const handleIrParaVendedor = () => {
    if (anuncio?.id_usuario) {
      router.push(`/vendedor/${anuncio.id_usuario}` as any);
    }
  };

  const precoPorUnidade = anuncio && anuncio.quantidade > 0
    ? (anuncio.preco / anuncio.quantidade).toFixed(2).replace('.', ',')
    : null;

  const co2EvitadoEstimado = anuncio ? (anuncio.quantidade * 1.8).toFixed(1) : 0;
  const aguaEconomizadaEstimada = anuncio ? Math.round(anuncio.quantidade * 12) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.loadingText}>Carregando detalhes sustentáveis...</Text>
      </SafeAreaView>
    );
  }

  if (!anuncio) return null;

  const temImagens = anuncio.imagens && anuncio.imagens.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {anuncio.anuncio_titulo}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleCompartilhar}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={20} color="#1E293B" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={toggleFavorito}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons 
              name={favoritado ? "heart" : "heart-outline"} 
              size={22} 
              color={favoritado ? "#DC2626" : "#1E293B"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop
        ]} 
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
          
          {/* COLUNA ESQUERDA: GALERIA E IMPACTO ECOLÓGICO */}
          <View style={[styles.leftColumn, isDesktop && styles.leftColumnDesktop]}>
            
            {/* Galeria de Fotos */}
            <View style={styles.galleryCard}>
              <View style={styles.mainImageWrapper}>
                {temImagens ? (
                  <Image 
                    source={{ uri: anuncio.imagens[imagemAtiva] || anuncio.imagens[0] }} 
                    style={styles.mainImage} 
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholderGallery}>
                    <MaterialCommunityIcons
                      name={getCategoryIcon(anuncio.categoria)}
                      size={90}
                      color="#16A34A"
                    />
                    <Text style={styles.placeholderText}>Sem foto cadastrada do produto</Text>
                  </View>
                )}

                {/* Badge da Categoria */}
                <View style={styles.categoryBadge}>
                  <MaterialCommunityIcons 
                    name={getCategoryIcon(anuncio.categoria)} 
                    size={16} 
                    color="#FFF" 
                  />
                  <Text style={styles.categoryBadgeText}>{anuncio.categoria}</Text>
                </View>

                {/* Badge de Sustentabilidade */}
                <View style={styles.ecoBadge}>
                  <MaterialCommunityIcons name="leaf" size={14} color="#15803D" />
                  <Text style={styles.ecoBadgeText}>Economia Circular</Text>
                </View>
              </View>

              {/* Miniaturas Clicáveis */}
              {temImagens && anuncio.imagens.length > 1 && (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.thumbnailsContainer}
                >
                  {anuncio.imagens.map((img, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      onPress={() => setImagemAtiva(index)}
                      style={[
                        styles.thumbnailWrapper,
                        imagemAtiva === index && styles.thumbnailActive
                      ]}
                    >
                      <Image source={{ uri: img }} style={styles.thumbnailImage} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Painel de Impacto Ambiental Estimado */}
            <View style={styles.impactCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="tree-outline" size={22} color="#16A34A" />
                <Text style={styles.cardSectionTitle}>Impacto Positivo Estimado</Text>
              </View>
              <Text style={styles.impactSubtitle}>
                Ao reaproveitar este lote, você evita o descarte inadequado e gera benefícios ambientais diretos:
              </Text>

              <View style={styles.impactMetricsGrid}>
                <View style={styles.impactMetricItem}>
                  <View style={[styles.impactIconBox, { backgroundColor: '#DCFCE7' }]}>
                    <MaterialCommunityIcons name="cloud-outline" size={22} color="#15803D" />
                  </View>
                  <Text style={styles.impactMetricValue}>~{co2EvitadoEstimado} kg</Text>
                  <Text style={styles.impactMetricLabel}>CO₂ Evitado</Text>
                </View>

                <View style={styles.impactMetricItem}>
                  <View style={[styles.impactIconBox, { backgroundColor: '#E0F2FE' }]}>
                    <MaterialCommunityIcons name="water-outline" size={22} color="#0369A1" />
                  </View>
                  <Text style={styles.impactMetricValue}>~{aguaEconomizadaEstimada} L</Text>
                  <Text style={styles.impactMetricLabel}>Água Poupada</Text>
                </View>

                <View style={styles.impactMetricItem}>
                  <View style={[styles.impactIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <MaterialCommunityIcons name="recycle" size={22} color="#B45309" />
                  </View>
                  <Text style={styles.impactMetricValue}>100%</Text>
                  <Text style={styles.impactMetricLabel}>Reciclável</Text>
                </View>
              </View>
            </View>

            {/* Selos de Segurança e Compra Protegida */}
            <View style={styles.securityCard}>
              <View style={styles.securityItem}>
                <MaterialCommunityIcons name="shield-check-outline" size={24} color="#16A34A" />
                <View style={styles.securityTextGroup}>
                  <Text style={styles.securityTitle}>Garantia Revirapp</Text>
                  <Text style={styles.securityDesc}>
                    Seu pagamento fica protegido até que a entrega ou retirada do lote seja confirmada.
                  </Text>
                </View>
              </View>

              <View style={styles.dividerHorizontal} />

              <View style={styles.securityItem}>
                <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#16A34A" />
                <View style={styles.securityTextGroup}>
                  <Text style={styles.securityTitle}>Logística Sustentável</Text>
                  <Text style={styles.securityDesc}>
                    Opção de negociação direta com freteiros parceiros e compensação de carbono.
                  </Text>
                </View>
              </View>
            </View>

          </View>

          {/* COLUNA DIREITA: INFORMAÇÕES, PREÇO, DESCRIÇÃO E VENDEDOR */}
          <View style={[styles.rightColumn, isDesktop && styles.rightColumnDesktop]}>
            
            {/* Bloco do Título e Status */}
            <View style={styles.titleCard}>
              <View style={styles.statusRow}>
                <View style={[
                  styles.statusBadge, 
                  anuncio.status === 'ativo' ? styles.statusActive : styles.statusInactive
                ]}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: anuncio.status === 'ativo' ? '#16A34A' : '#DC2626' }
                  ]} />
                  <Text style={[
                    styles.statusText,
                    { color: anuncio.status === 'ativo' ? '#15803D' : '#991B1B' }
                  ]}>
                    {anuncio.status === 'ativo' ? 'LOTE DISPONÍVEL' : anuncio.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.dateText}>Publicado em {dataFormatada}</Text>
              </View>

              <Text style={styles.title}>{anuncio.anuncio_titulo}</Text>
            </View>

            {/* Painel de Preço Destacado e Custo Fracionado */}
            <View style={styles.priceCard}>
              <View style={styles.priceMainGroup}>
                <Text style={styles.priceLabel}>Valor do Lote Completo</Text>
                <Text style={styles.priceValue}>
                  R$ {Number(anuncio.preco).toFixed(2).replace('.', ',')}
                </Text>
                {precoPorUnidade && (
                  <Text style={styles.priceUnitText}>
                    Aproximadamente <Text style={styles.priceUnitBold}>R$ {precoPorUnidade}</Text> por {anuncio.unidade_medida}
                  </Text>
                )}
              </View>

              <View style={styles.quantityBadge}>
                <MaterialCommunityIcons name="scale-balance" size={22} color="#16A34A" />
                <View>
                  <Text style={styles.quantityLabel}>Volume Total</Text>
                  <Text style={styles.quantityText}>
                    {Number(anuncio.quantidade)} {anuncio.unidade_medida}
                  </Text>
                </View>
              </View>
            </View>

            {/* Especificações Técnicas do Material */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#16A34A" />
                <Text style={styles.cardSectionTitle}>Especificações Técnicas</Text>
              </View>
              
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Nome do Material</Text>
                  <Text style={styles.infoValue}>{anuncio.material_nome}</Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Categoria</Text>
                  <Text style={styles.infoValue}>{anuncio.categoria}</Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Quantidade Cadastrada</Text>
                  <Text style={styles.infoValue}>
                    {Number(anuncio.quantidade)} {anuncio.unidade_medida}
                  </Text>
                </View>

                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Valor Unitário Médio</Text>
                  <Text style={styles.infoValue}>
                    {precoPorUnidade ? `R$ ${precoPorUnidade} / ${anuncio.unidade_medida}` : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Descrição Detalhada do Material */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                {/* <MaterialCommunityIcons name="text-subject" size={22} color="#16A34A" /> */}
                <Text style={styles.cardSectionTitle}>Descrição do Anúncio</Text>
              </View>
              <Text style={styles.descriptionText}>
                {anuncio.descricao || 'O anunciante não incluiu uma descrição estendida para este lote. Entre em contato diretamente pelo chat para tirar dúvidas sobre higienização, triagem ou estado do material.'}
              </Text>
            </View>

            {/* Card Completo do Vendedor com Link de Navegação */}
            <View style={styles.sellerCard}>
              <TouchableOpacity 
                style={styles.sellerTopRow} 
                onPress={handleIrParaVendedor}
                activeOpacity={0.7}
              >
                <View style={styles.sellerAvatar}>
                  <MaterialCommunityIcons name="account" size={32} color="#15803D" />
                </View>

                <View style={styles.sellerDetails}>
                  <View style={styles.sellerNameRow}>
                    <Text style={styles.sellerName}>{anuncio.vendedor_nome}</Text>
                    <MaterialCommunityIcons name="check-decagram" size={18} color="#16A34A" />
                  </View>
                  
                  <View style={styles.sellerLocationRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={15} color="#64748B" />
                    <Text style={styles.sellerLocation}>
                      {anuncio.cidade && anuncio.estado
                        ? `${anuncio.cidade} - ${anuncio.estado}`
                        : 'Localização não informada'}
                    </Text>
                  </View>
                </View>

                <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
              </TouchableOpacity>

              <View style={styles.sellerActionsRow}>
                <TouchableOpacity
                  style={styles.sellerProfileButton}
                  onPress={handleIrParaVendedor}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="account-search-outline" size={18} color="#15803D" />
                  <Text style={styles.sellerProfileButtonText}>Ver Perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rateButton}
                  onPress={() => router.push('/avaliacao' as any)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="star" size={18} color="#D97706" />
                  <Text style={styles.rateButtonText}>Avaliar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sellerStatsRow}>
                <View style={styles.sellerStatItem}>
                  <Text style={styles.sellerStatValue}>98%</Text>
                  <Text style={styles.sellerStatLabel}>Respostas rápidas</Text>
                </View>
                <View style={styles.sellerStatDivider} />
                <View style={styles.sellerStatItem}>
                  <Text style={styles.sellerStatValue}>
                    {anuncio.vendedor_tipo ? anuncio.vendedor_tipo.toUpperCase() : 'PARCEIRO'}
                  </Text>
                  <Text style={styles.sellerStatLabel}>Perfil Cadastrado</Text>
                </View>
              </View>
            </View>

            {/* Botões Principais no Desktop */}
            {isDesktop && (
              <View style={styles.desktopButtonsContainer}>
                {podeComprar && (
                  <TouchableOpacity
                    style={styles.buyButtonDesktop}
                    onPress={handleComprar}
                    disabled={comprando}
                    activeOpacity={0.85}
                  >
                    {comprando ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="cart-outline" size={22} color="#FFF" />
                        <Text style={styles.buyButtonText}>Comprar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.chatButtonDesktop}
                  onPress={() => router.push({ pathname: '/chat', params: { id_anuncio: anuncio.id_anuncio, id_vendedor: anuncio.id_usuario } })}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="message-text-outline" size={22} color="#FFF" />
                  <Text style={styles.chatButtonText}>Conversar com o Vendedor</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Footer Fixo Apenas para Mobile */}
      {!isDesktop && (
        <View style={styles.footerMobile}>
          {podeComprar && (
            <TouchableOpacity
              style={styles.buyButton}
              onPress={handleComprar}
              disabled={comprando}
              activeOpacity={0.85}
            >
              {comprando ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="cart-outline" size={22} color="#FFF" />
                  <Text style={styles.buyButtonText}>Comprar</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.chatButtonMobile}
            onPress={() => router.push({ pathname: '/chat', params: { id_anuncio: anuncio.id_anuncio, id_vendedor: anuncio.id_usuario } })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="message-text-outline" size={22} color="#FFF" />
            <Text style={styles.chatButtonText}>Conversar com o Vendedor</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
  },

  /* Header Superior */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  iconButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },

  /* Estrutura de Layout e Espaçamentos */
  scrollContent: {
    paddingBottom: 160,
  },
  scrollContentDesktop: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  mainLayout: {
    width: '100%',
    padding: 16,
    gap: 24,
  },
  mainLayoutDesktop: {
    maxWidth: 1200,
    flexDirection: 'row',
    gap: 32,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
  },

  leftColumn: {
    width: '100%',
    gap: 24,
  },
  leftColumnDesktop: {
    flex: 1.1,
  },
  rightColumn: {
    width: '100%',
    gap: 24,
  },
  rightColumnDesktop: {
    flex: 1,
  },

  /* Galeria de Fotos Aprimorada */
  galleryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  mainImageWrapper: {
    width: '100%',
    height: 340,
    backgroundColor: '#F1F5F9',
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  placeholderGallery: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  ecoBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  ecoBadgeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailsContainer: {
    paddingTop: 16,
    gap: 12,
  },
  thumbnailWrapper: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  thumbnailActive: {
    borderColor: '#16A34A',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },

  /* Impacto Ambiental Card */
  impactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  impactSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
  impactMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  impactMetricItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  impactIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  impactMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  impactMetricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },

  /* Seguraça Card */
  securityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  securityTextGroup: {
    flex: 1,
    gap: 2,
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  securityDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  dividerHorizontal: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  /* Card Título e Status */
  titleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 32,
  },

  /* Preço e Custo Fracionado */
  priceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceMainGroup: {
    gap: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 30,
    fontWeight: '900',
    color: '#16A34A',
  },
  priceUnitText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  priceUnitBold: {
    color: '#0F172A',
    fontWeight: '700',
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  quantityLabel: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
  },

  /* Seções Genéricas de Card */
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Especificações Grid */
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  infoItem: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  descriptionText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },

  /* Vendedor Card Expandido com Navegação */
  sellerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  sellerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sellerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerDetails: {
    flex: 1,
    gap: 4,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sellerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sellerLocation: {
    fontSize: 13,
    color: '#64748B',
  },
  sellerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sellerProfileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  sellerProfileButtonText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rateButtonText: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '700',
  },
  sellerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    borderRadius: 12,
  },
  sellerStatItem: {
    alignItems: 'center',
  },
  sellerStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  sellerStatLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sellerStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },

  /* Botão Desktop */
  desktopButtonsContainer: {
    gap: 12,
  },
  buyButtonDesktop: {
    backgroundColor: '#15803D',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  chatButtonDesktop: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },

  /* Footer Mobile */
  footerMobile: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 10,
    gap: 10,
  },
  buyButton: {
    backgroundColor: '#15803D',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  chatButtonMobile: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});