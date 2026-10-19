import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { API_BASE_URL } from '../../config/api';

// Interfaces ajustadas com base nas respostas do backend (server.js)
interface Vendedor {
  id_usuario: number;
  usuario_nome: string;
  email: string;
  tipo: string;
  cpf_cnpj: string | null;
  data_cadastro: string;
}

interface Endereco {
  id_endereco: number;
  id_usuario: number;
  logradouro: string | null;
  cidade: string;
  estado: string;
  cep: string | null;
}

interface Avaliacao {
  id_avaliacao: number;
  id_transacao: number;
  id_avaliador: number;
  id_avaliado: number;
  nota: number;
  comentario: string;
  avaliador_nome: string;
}

interface Anuncio {
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

export default function PerfilVendedorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idVendedor = params.id;

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // Layout adaptativo para telas grandes

  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [endereco, setEndereco] = useState<Endereco | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isFavorito, setIsFavorito] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'anuncios' | 'avaliacoes'>('anuncios');

  // Buscar todos os dados nos endpoints do Node.js
  const carregarPerfil = useCallback(async () => {
    if (!idVendedor) return;

    try {
      setLoading(true);

      const [resUsuario, resEndereco, resAvaliacoes, resAnuncios] = await Promise.all([
        fetch(`${API_BASE_URL}/usuario/${idVendedor}`),
        fetch(`${API_BASE_URL}/endereco/usuario/${idVendedor}`),
        fetch(`${API_BASE_URL}/usuarios/${idVendedor}/avaliacoes`),
        fetch(`${API_BASE_URL}/anuncios`),
      ]);

      if (resUsuario.ok) {
        const dataUsuario = await resUsuario.json();
        setVendedor(dataUsuario);
      } else {
        Alert.alert('Erro', 'Vendedor não encontrado.');
        router.back();
        return;
      }

      if (resEndereco.ok) {
        const dataEndereco = await resEndereco.json();
        if (Array.isArray(dataEndereco) && dataEndereco.length > 0) {
          setEndereco(dataEndereco[0]);
        }
      }

      if (resAvaliacoes.ok) {
        const dataAvaliacoes = await resAvaliacoes.json();
        setAvaliacoes(Array.isArray(dataAvaliacoes) ? dataAvaliacoes : []);
      }

      if (resAnuncios.ok) {
        const dataAnuncios: Anuncio[] = await resAnuncios.json();
        // Filtra os anúncios pertencentes a este id_usuario
        const anunciosDoVendedor = dataAnuncios.filter(
          (item) => String(item.id_usuario) === String(idVendedor)
        );
        setAnuncios(anunciosDoVendedor);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do vendedor:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  }, [idVendedor, router]);

  useEffect(() => {
    carregarPerfil();
  }, [carregarPerfil]);

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

  const formatarDataCadastro = (dataIso?: string) => {
    if (!dataIso) return 'Data não informada';
    const data = new Date(dataIso);
    const mes = data.toLocaleDateString('pt-BR', { month: 'short' });
    const ano = data.getFullYear();
    return `Membro desde ${mes.charAt(0).toUpperCase() + mes.slice(1)} de ${ano}`;
  };

  const mediaNotas = avaliacoes.length > 0
    ? (avaliacoes.reduce((acc, curr) => acc + Number(curr.nota), 0) / avaliacoes.length).toFixed(1)
    : '5.0';

  const handleCompartilhar = async () => {
    try {
      if (vendedor) {
        await Share.share({
          message: `Confira os produtos e insumos recicláveis de ${vendedor.usuario_nome} no Revirapp!`,
        });
      }
    } catch (error) {
      console.error('Erro ao compartilhar perfil:', error);
    }
  };

  const renderEstrelas = (nota: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialCommunityIcons
            key={star}
            name={star <= nota ? 'star' : 'star-outline'}
            size={16}
            color="#D97706"
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.loadingText}>Carregando perfil do vendedor...</Text>
      </SafeAreaView>
    );
  }

  if (!vendedor) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Superior */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1E293B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Perfil do Vendedor
        </Text>

        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.iconButton} onPress={handleCompartilhar} activeOpacity={0.7}>
            <MaterialCommunityIcons name="share-variant-outline" size={20} color="#1E293B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={() => setIsFavorito(!isFavorito)} activeOpacity={0.7}>
            <MaterialCommunityIcons
              name={isFavorito ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorito ? '#DC2626' : '#1E293B'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
          
          {/* PAINEL ESQUERDO / SIDEBAR (BIO & CARDS DE INFORMAÇÃO) */}
          <View style={[styles.sidebarPanel, isDesktop && styles.sidebarPanelDesktop]}>
            
            {/* Header com Banner e Avatar */}
            <View style={styles.profileCard}>
              <View style={styles.bannerHeader}>
                <View style={styles.avatarWrapper}>
                  <View style={styles.avatarCircle}>
                    <MaterialCommunityIcons name="account" size={48} color="#15803D" />
                  </View>
                  <View style={styles.verifiedIcon}>
                    <MaterialCommunityIcons name="check-decagram" size={20} color="#16A34A" />
                  </View>
                </View>
              </View>

              <View style={styles.profileBody}>
                <Text style={styles.vendedorNome}>{vendedor.usuario_nome}</Text>
                
                <View style={styles.typeBadge}>
                  <MaterialCommunityIcons name="leaf" size={14} color="#15803D" />
                  <Text style={styles.typeBadgeText}>
                    {vendedor.tipo ? vendedor.tipo.toUpperCase() : 'PARCEIRO RECIRCULAR'}
                  </Text>
                </View>

                <View style={styles.locationRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={16} color="#64748B" />
                  <Text style={styles.locationText}>
                    {endereco?.cidade && endereco?.estado
                      ? `${endereco.cidade} - ${endereco.estado}`
                      : 'Localização não cadastrada'}
                  </Text>
                </View>

                <Text style={styles.dataCadastroText}>
                  {formatarDataCadastro(vendedor.data_cadastro)}
                </Text>

                {/* Métricas e Reputação */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <View style={styles.ratingBox}>
                      <MaterialCommunityIcons name="star" size={18} color="#D97706" />
                      <Text style={styles.ratingScoreText}>{mediaNotas}</Text>
                    </View>
                    <Text style={styles.metricLabel}>{avaliacoes.length} avaliações</Text>
                  </View>

                  <View style={styles.metricDivider} />

                  <View style={styles.metricItem}>
                    <Text style={styles.metricValueText}>{anuncios.length}</Text>
                    <Text style={styles.metricLabel}>Lotes ativos</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Card de Selos e Segurança */}
            <View style={styles.securityCard}>
              <View style={styles.securityItem}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color="#16A34A" />
                <View style={styles.securityTextGroup}>
                  <Text style={styles.securityTitle}>Vendedor Verificado</Text>
                  <Text style={styles.securityDesc}>
                    Identidade e dados cadastrais auditados pela equipe Revirapp.
                  </Text>
                </View>
              </View>

              <View style={styles.securityItem}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#16A34A" />
                <View style={styles.securityTextGroup}>
                  <Text style={styles.securityTitle}>E-mail Confirmado</Text>
                  <Text style={styles.securityDesc}>{vendedor.email}</Text>
                </View>
              </View>
            </View>

            {/* Ações Principais no Desktop */}
            {isDesktop && (
              <View style={styles.desktopActionsBox}>
                <TouchableOpacity
                  style={styles.btnPrimaryChat}
                  onPress={() => router.push('/chat')}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="message-text-outline" size={20} color="#FFF" />
                  <Text style={styles.btnPrimaryChatText}>Conversar no Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.btnSecondaryAvaliar}
                  onPress={() => router.push('/avaliacao' as any)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="star-outline" size={20} color="#D97706" />
                  <Text style={styles.btnSecondaryAvaliarText}>Avaliar Vendedor</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* COLUNA DIREITA / CONTEÚDO PRINCIPAL (ANÚNCIOS E AVALIAÇÕES) */}
          <View style={[styles.mainContentPanel, isDesktop && styles.mainContentPanelDesktop]}>
            
            {/* Abas para Navegação Mobile */}
            {!isDesktop && (
              <View style={styles.mobileTabsContainer}>
                <TouchableOpacity
                  style={[styles.tabButton, abaAtiva === 'anuncios' && styles.tabButtonActive]}
                  onPress={() => setAbaAtiva('anuncios')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabButtonText, abaAtiva === 'anuncios' && styles.tabButtonTextActive]}>
                    Lotes à Venda ({anuncios.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, abaAtiva === 'avaliacoes' && styles.tabButtonActive]}
                  onPress={() => setAbaAtiva('avaliacoes')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabButtonText, abaAtiva === 'avaliacoes' && styles.tabButtonTextActive]}>
                    Avaliações ({avaliacoes.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SEÇÃO 1: VITRINE DE ANÚNCIOS DO VENDEDOR */}
            {(isDesktop || abaAtiva === 'anuncios') && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name="store-outline" size={22} color="#16A34A" />
                  <Text style={styles.sectionTitle}>Anúncios Ativos ({anuncios.length})</Text>
                </View>

                {anuncios.length > 0 ? (
                  <View style={styles.anunciosGrid}>
                    {anuncios.map((item) => (
                      <TouchableOpacity
                        key={item.id_anuncio}
                        style={[styles.anuncioCard, isDesktop && styles.anuncioCardDesktop]}
                        onPress={() => router.push(`/detalhes?id=${item.id_anuncio}` as any)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.anuncioImageContainer}>
                          {item.imagem_capa ? (
                            <Image source={{ uri: item.imagem_capa }} style={styles.anuncioImage} resizeMode="cover" />
                          ) : (
                            <View style={styles.anuncioPlaceholder}>
                              <MaterialCommunityIcons name={getCategoryIcon(item.categoria)} size={44} color="#16A34A" />
                            </View>
                          )}

                          <View style={styles.categoryBadge}>
                            <Text style={styles.categoryBadgeText}>{item.categoria}</Text>
                          </View>
                        </View>

                        <View style={styles.anuncioContent}>
                          <Text style={styles.anuncioTitulo} numberOfLines={2}>
                            {item.anuncio_titulo}
                          </Text>

                          <View style={styles.anuncioPriceRow}>
                            <View>
                              <Text style={styles.priceLabel}>Preço do Lote</Text>
                              <Text style={styles.priceValue}>
                                R$ {Number(item.preco).toFixed(2).replace('.', ',')}
                              </Text>
                            </View>

                            <View style={styles.quantityTag}>
                              <MaterialCommunityIcons name="scale-balance" size={14} color="#15803D" />
                              <Text style={styles.quantityTagText}>
                                {item.quantidade} {item.unidade_medida}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="recycle-variant" size={54} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>Nenhum anúncio ativo</Text>
                    <Text style={styles.emptyText}>
                      Este vendedor não possui lotes cadastrados no momento.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* SEÇÃO 2: AVALIAÇÕES E REPUTAÇÃO DO VENDEDOR */}
            {(isDesktop || abaAtiva === 'avaliacoes') && (
              <View style={[styles.sectionBlock, isDesktop && { marginTop: 24 }]}>
                <View style={styles.sectionHeaderBetween}>
                  <View style={styles.sectionHeaderLeft}>
                    <MaterialCommunityIcons name="star-face" size={22} color="#16A34A" />
                    <Text style={styles.sectionTitle}>Avaliações dos Compradores ({avaliacoes.length})</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.addReviewBtn}
                    onPress={() => router.push('/avaliacao' as any)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color="#15803D" />
                    <Text style={styles.addReviewBtnText}>Avaliar</Text>
                  </TouchableOpacity>
                </View>

                {avaliacoes.length > 0 ? (
                  <View style={styles.avaliacoesList}>
                    {avaliacoes.map((item, index) => (
                      <View key={item.id_avaliacao || index} style={styles.avaliacaoCard}>
                        <View style={styles.avaliacaoHeader}>
                          <View style={styles.avaliadorAvatar}>
                            <MaterialCommunityIcons name="account" size={20} color="#15803D" />
                          </View>
                          <View style={styles.avaliadorInfo}>
                            <Text style={styles.avaliadorNome}>{item.avaliador_nome || 'Comprador Reciclador'}</Text>
                            {renderEstrelas(item.nota)}
                          </View>
                        </View>

                        <Text style={styles.avaliacaoComentario}>
                          "{item.comentario || 'Sem comentário adicional.'}"
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons name="star-outline" size={54} color="#94A3B8" />
                    <Text style={styles.emptyTitle}>Nenhuma avaliação recebida</Text>
                    <Text style={styles.emptyText}>
                      Este vendedor ainda não foi avaliado por outros usuários na plataforma.
                    </Text>
                  </View>
                )}
              </View>
            )}

          </View>
        </View>
      </ScrollView>

      {/* RODAPÉ FIXO DE AÇÃO PARA DISPOSITIVOS MÓVEIS */}
      {!isDesktop && (
        <View style={styles.mobileFooterSticky}>
          <TouchableOpacity
            style={styles.mobileChatButton}
            onPress={() => router.push('/chat')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="message-text-outline" size={22} color="#FFF" />
            <Text style={styles.mobileChatButtonText}>Conversar no Chat</Text>
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
    marginTop: 14,
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 12,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },

  /* Layout Geral */
  scrollContent: {
    paddingBottom: 100,
  },
  scrollContentDesktop: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  mainLayout: {
    width: '100%',
    padding: 16,
    gap: 20,
  },
  mainLayoutDesktop: {
    maxWidth: 1200,
    flexDirection: 'row',
    gap: 32,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
  },

  /* Sidebar Esquerda */
  sidebarPanel: {
    width: '100%',
    gap: 20,
  },
  sidebarPanelDesktop: {
    flex: 1,
    maxWidth: 380,
  },

  /* Profile Card */
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  bannerHeader: {
    height: 80,
    backgroundColor: '#15803D',
    position: 'relative',
    marginBottom: 42,
  },
  avatarWrapper: {
    position: 'absolute',
    bottom: -36,
    alignSelf: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  profileBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  vendedorNome: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#64748B',
  },
  dataCadastroText: {
    fontSize: 12,
    color: '#94A3B8',
  },

  /* Métricas */
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 8,
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingScoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#D97706',
  },
  metricValueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },

  /* Card Segurança */
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
    gap: 12,
  },
  securityTextGroup: {
    flex: 1,
    gap: 2,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  securityDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },

  /* Botões Desktop */
  desktopActionsBox: {
    gap: 10,
  },
  btnPrimaryChat: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  btnPrimaryChatText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondaryAvaliar: {
    backgroundColor: '#FFFBEB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  btnSecondaryAvaliarText: {
    color: '#D97706',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Conteúdo Principal */
  mainContentPanel: {
    width: '100%',
    gap: 16,
  },
  mainContentPanelDesktop: {
    flex: 2,
  },

  /* Abas Mobile */
  mobileTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#16A34A',
    fontWeight: '700',
  },

  /* Seção de Conteúdo */
  sectionBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  addReviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Grid Anúncios */
  anunciosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  anuncioCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  anuncioCardDesktop: {
    width: '48%',
  },
  anuncioImageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  anuncioImage: {
    width: '100%',
    height: '100%',
  },
  anuncioPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  anuncioContent: {
    padding: 14,
    gap: 10,
  },
  anuncioTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  anuncioPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#16A34A',
  },
  quantityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  quantityTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Lista de Avaliações */
  avaliacoesList: {
    gap: 12,
  },
  avaliacaoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  avaliacaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avaliadorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avaliadorInfo: {
    gap: 2,
  },
  avaliadorNome: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  avaliacaoComentario: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  /* Estado Vazio */
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },

  /* Sticky Footer Mobile */
  mobileFooterSticky: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 10,
  },
  mobileChatButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
  },
  mobileChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});