// import { MaterialCommunityIcons } from '@expo/vector-icons';
// import { useLocalSearchParams, useRouter } from 'expo-router';
// import { useCallback, useEffect, useState } from 'react';
// import {
//     ActivityIndicator,
//     Alert,
//     Image,
//     SafeAreaView,
//     ScrollView,
//     Share,
//     StyleSheet,
//     Text,
//     TouchableOpacity,
//     useWindowDimensions,
//     View,
// } from 'react-native';
// import { API_BASE_URL } from '../config/api';

// interface VendedorPerfil {
//   id_usuario: number;
//   vendedor_nome: string;
//   vendedor_email: string;
//   vendedor_tipo: string;
//   cidade: string | null;
//   estado: string | null;
//   avaliacao_media?: number;
//   total_avaliacoes?: number;
//   taxa_resposta?: string;
//   membro_desde?: string;
// }

// interface AnuncioItem {
//   id_anuncio: number;
//   anuncio_titulo: string;
//   preco: number;
//   quantidade: number;
//   unidade_medida: string;
//   categoria: string;
//   material_nome: string;
//   status: string;
//   imagens: string[];
// }

// export default function PerfilVendedorScreen() {
//   const router = useRouter();
//   const params = useLocalSearchParams();
//   const idVendedor = params.id;

//   const { width } = useWindowDimensions();
//   const isDesktop = width >= 768; // Breakpoint de layout Desktop / Web

//   const [vendedor, setVendedor] = useState<VendedorPerfil | null>(null);
//   const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [isFavorito, setIsFavorito] = useState(false);

//   // Busca os dados do perfil do vendedor e a lista de anúncios cadastrados por ele
//   const carregarDadosVendedor = useCallback(async () => {
//     if (!idVendedor) return;

//     try {
//       setLoading(true);
//       // Requisição do perfil do vendedor
//       const resVendedor = await fetch(`${API_BASE_URL}/usuarios/${idVendedor}`);
      
//       if (resVendedor.ok) {
//         const dataVendedor = await resVendedor.json();
//         setVendedor(dataVendedor);
//       } else {
//         // Fallback genérico caso a API retorne vendedor atrelado aos anúncios
//         setVendedor({
//           id_usuario: Number(idVendedor),
//           vendedor_nome: 'Vendedor Parceiro',
//           vendedor_email: 'contato@revirapp.com.br',
//           vendedor_tipo: 'Cooperativa Recicladora',
//           cidade: 'São Paulo',
//           estado: 'SP',
//           avaliacao_media: 4.9,
//           total_avaliacoes: 28,
//           taxa_resposta: '98%',
//           membro_desde: '2023',
//         });
//       }

//       // Requisição dos anúncios do vendedor
//       const resAnuncios = await fetch(`${API_BASE_URL}/anuncios?id_usuario=${idVendedor}`);
//       if (resAnuncios.ok) {
//         const dataAnuncios = await resAnuncios.json();
//         setAnuncios(Array.isArray(dataAnuncios) ? dataAnuncios : []);
//       }
//     } catch (error) {
//       console.error('Erro ao buscar dados do vendedor:', error);
//       Alert.alert('Erro', 'Não foi possível carregar as informações do vendedor.');
//     } finally {
//       setLoading(false);
//     }
//   }, [idVendedor]);

//   useEffect(() => {
//     carregarDadosVendedor();
//   }, [carregarDadosVendedor]);

//   const handleCompartilhar = async () => {
//     try {
//       if (vendedor) {
//         await Share.share({
//           message: `Confira o perfil de ${vendedor.vendedor_nome} no Revirapp - Marketplace Sustentável!`,
//         });
//       }
//     } catch (error) {
//       console.error('Erro ao compartilhar perfil:', error);
//     }
//   };

//   const getCategoryIcon = (categoria: string) => {
//     switch (categoria?.toLowerCase()) {
//       case 'papel':
//       case 'papelão':
//         return 'file-document-outline';
//       case 'plástico':
//       case 'plastico':
//         return 'bottle-soda-outline';
//       case 'vidro':
//         return 'glass-fragile';
//       case 'metal':
//         return 'cog-outline';
//       case 'eletrônicos':
//       case 'eletronicos':
//         return 'power-plug-outline';
//       default:
//         return 'recycle';
//     }
//   };

//   if (loading) {
//     return (
//       <SafeAreaView style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#16A34A" />
//         <Text style={styles.loadingText}>Carregando perfil sustentável...</Text>
//       </SafeAreaView>
//     );
//   }

//   if (!vendedor) return null;

//   return (
//     <SafeAreaView style={styles.container}>
//       {/* Header Superior da Tela */}
//       <View style={styles.header}>
//         <View style={styles.headerLeft}>
//           <TouchableOpacity
//             style={styles.iconButton}
//             onPress={() => router.back()}
//             activeOpacity={0.7}
//           >
//             <MaterialCommunityIcons name="arrow-left" size={22} color="#1E293B" />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle} numberOfLines={1}>
//             Perfil do Vendedor
//           </Text>
//         </View>

//         <View style={styles.headerRight}>
//           <TouchableOpacity
//             style={styles.iconButton}
//             onPress={handleCompartilhar}
//             activeOpacity={0.7}
//           >
//             <MaterialCommunityIcons name="share-variant-outline" size={20} color="#1E293B" />
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={styles.iconButton}
//             onPress={() => setIsFavorito(!isFavorito)}
//             activeOpacity={0.7}
//           >
//             <MaterialCommunityIcons
//               name={isFavorito ? 'heart' : 'heart-outline'}
//               size={22}
//               color={isFavorito ? '#DC2626' : '#1E293B'}
//             />
//           </TouchableOpacity>
//         </View>
//       </View>

//       <ScrollView
//         contentContainerStyle={[
//           styles.scrollContent,
//           isDesktop && styles.scrollContentDesktop,
//         ]}
//         showsVerticalScrollIndicator={false}
//       >
//         <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
          
//           {/* PAINEL DO VENDEDOR (SIDEBAR DESKTOP / TOPO MOBILE) */}
//           <View style={[styles.sidebar, isDesktop && styles.sidebarDesktop]}>
            
//             {/* Card Principal de Identidade */}
//             <View style={styles.profileCard}>
//               <View style={styles.avatarContainer}>
//                 <View style={styles.avatarWrapper}>
//                   <MaterialCommunityIcons name="account" size={54} color="#15803D" />
//                 </View>

//                 <View style={styles.verificationBadge}>
//                   <MaterialCommunityIcons name="check-decagram" size={22} color="#16A34A" />
//                 </View>
//               </View>

//               <Text style={styles.vendedorName}>{vendedor.vendedor_nome}</Text>

//               {vendedor.vendedor_tipo && (
//                 <View style={styles.vendedorTypeBadge}>
//                   <MaterialCommunityIcons name="leaf" size={14} color="#15803D" />
//                   <Text style={styles.vendedorTypeText}>
//                     {vendedor.vendedor_tipo.toUpperCase()}
//                   </Text>
//                 </View>
//               )}

//               <View style={styles.locationContainer}>
//                 <MaterialCommunityIcons name="map-marker-outline" size={16} color="#64748B" />
//                 <Text style={styles.locationText}>
//                   {vendedor.cidade && vendedor.estado
//                     ? `${vendedor.cidade} - ${vendedor.estado}`
//                     : 'Localização não informada'}
//                 </Text>
//               </View>

//               <View style={styles.emailContainer}>
//                 <MaterialCommunityIcons name="email-outline" size={16} color="#64748B" />
//                 <Text style={styles.emailText}>{vendedor.vendedor_email}</Text>
//               </View>

//               {/* Avaliação e Reputação */}
//               <View style={styles.ratingCard}>
//                 <View style={styles.ratingRow}>
//                   <MaterialCommunityIcons name="star" size={22} color="#D97706" />
//                   <Text style={styles.ratingValue}>
//                     {vendedor.avaliacao_media ? vendedor.avaliacao_media.toFixed(1) : '5.0'}
//                   </Text>
//                   <Text style={styles.ratingCount}>
//                     ({vendedor.total_avaliacoes || 12} avaliações)
//                   </Text>
//                 </View>

//                 <TouchableOpacity
//                   style={styles.rateActionButton}
//                   onPress={() => router.push('/avaliacao' as any)}
//                   activeOpacity={0.7}
//                 >
//                   <Text style={styles.rateActionButtonText}>Avaliar Vendedor</Text>
//                 </TouchableOpacity>
//               </View>

//               {/* Botão de Chat para Desktop no Painel Fixo */}
//               {isDesktop && (
//                 <TouchableOpacity
//                   style={styles.chatButtonPrimary}
//                   onPress={() => router.push('/chat')}
//                   activeOpacity={0.85}
//                 >
//                   <MaterialCommunityIcons name="message-text-outline" size={20} color="#FFF" />
//                   <Text style={styles.chatButtonText}>Conversar com o Vendedor</Text>
//                 </TouchableOpacity>
//               )}
//             </View>

//             {/* Card de Métricas do Vendedor */}
//             <View style={styles.statsCard}>
//               <Text style={styles.statsCardTitle}>Estatísticas da Conta</Text>

//               <View style={styles.statsGrid}>
//                 <View style={styles.statBox}>
//                   <Text style={styles.statNumber}>
//                     {vendedor.taxa_resposta || '98%'}
//                   </Text>
//                   <Text style={styles.statLabel}>Taxa de Resposta</Text>
//                 </View>

//                 <View style={styles.statBox}>
//                   <Text style={styles.statNumber}>{anuncios.length}</Text>
//                   <Text style={styles.statLabel}>Lotes Ativos</Text>
//                 </View>

//                 <View style={styles.statBox}>
//                   <Text style={styles.statNumber}>
//                     {vendedor.membro_desde || '2023'}
//                   </Text>
//                   <Text style={styles.statLabel}>Membro Desde</Text>
//                 </View>

//                 <View style={styles.statBox}>
//                   <Text style={[styles.statNumber, { color: '#16A34A' }]}>100%</Text>
//                   <Text style={styles.statLabel}>Entrega Segura</Text>
//                 </View>
//               </View>
//             </View>

//           </View>

//           {/* CONTEÚDO PRINCIPAL (ANÚNCIOS DO VENDEDOR) */}
//           <View style={[styles.contentArea, isDesktop && styles.contentAreaDesktop]}>
            
//             {/* Banner de Impacto Sustentável do Vendedor */}
//             <View style={styles.ecoBanner}>
//               <View style={styles.ecoBannerIcon}>
//                 <MaterialCommunityIcons name="recycle" size={28} color="#15803D" />
//               </View>
//               <View style={styles.ecoBannerContent}>
//                 <Text style={styles.ecoBannerTitle}>Vendedor Parceiro Circular</Text>
//                 <Text style={styles.ecoBannerDesc}>
//                   Este perfil comercializa materiais recicláveis e reaproveitados auditados, reduzindo o impacto ambiental.
//                 </Text>
//               </View>
//             </View>

//             {/* Cabeçalho da Seção de Produtos */}
//             <View style={styles.sectionHeader}>
//               <View style={styles.sectionTitleGroup}>
//                 <MaterialCommunityIcons name="package-variant-closed" size={22} color="#16A34A" />
//                 <Text style={styles.sectionTitle}>Lotes Cadastrados</Text>
//                 <View style={styles.badgeCounter}>
//                   <Text style={styles.badgeCounterText}>{anuncios.length}</Text>
//                 </View>
//               </View>
//             </View>

//             {/* Grid ou Lista de Anúncios */}
//             {anuncios.length > 0 ? (
//               <View style={[styles.anunciosGrid, isDesktop && styles.anunciosGridDesktop]}>
//                 {anuncios.map((item) => (
//                   <TouchableOpacity
//                     key={item.id_anuncio}
//                     style={[styles.anuncioCard, isDesktop && styles.anuncioCardDesktop]}
//                     onPress={() => router.push(`/anuncio_detalhes?id=${item.id_anuncio}` as any)}
//                     activeOpacity={0.8}
//                   >
//                     <View style={styles.anuncioImageWrapper}>
//                       {item.imagens && item.imagens.length > 0 ? (
//                         <Image source={{ uri: item.imagens[0] }} style={styles.anuncioImage} />
//                       ) : (
//                         <View style={styles.anuncioPlaceholder}>
//                           <MaterialCommunityIcons
//                             name={getCategoryIcon(item.categoria)}
//                             size={40}
//                             color="#16A34A"
//                           />
//                         </View>
//                       )}

//                       <View style={styles.anuncioCategoryBadge}>
//                         <Text style={styles.anuncioCategoryText}>{item.categoria}</Text>
//                       </View>
//                     </View>

//                     <View style={styles.anuncioBody}>
//                       <Text style={styles.anuncioTitle} numberOfLines={2}>
//                         {item.anuncio_titulo}
//                       </Text>

//                       <View style={styles.anuncioQuantityRow}>
//                         <MaterialCommunityIcons name="scale-balance" size={14} color="#64748B" />
//                         <Text style={styles.anuncioQuantityText}>
//                           {Number(item.quantidade)} {item.unidade_medida}
//                         </Text>
//                       </View>

//                       <View style={styles.anuncioFooter}>
//                         <View>
//                           <Text style={styles.anuncioPriceLabel}>Valor do lote</Text>
//                           <Text style={styles.anuncioPriceValue}>
//                             R$ {Number(item.preco).toFixed(2).replace('.', ',')}
//                           </Text>
//                         </View>

//                         <View style={styles.anuncioArrowBtn}>
//                           <MaterialCommunityIcons name="chevron-right" size={20} color="#16A34A" />
//                         </View>
//                       </View>
//                     </View>
//                   </TouchableOpacity>
//                 ))}
//               </View>
//             ) : (
//               <View style={styles.emptyContainer}>
//                 <MaterialCommunityIcons name="package-variant-remove" size={60} color="#CBD5E1" />
//                 <Text style={styles.emptyTitle}>Nenhum lote ativo no momento</Text>
//                 <Text style={styles.emptyDesc}>
//                   Este vendedor não possui materiais cadastrados disponíveis atualmente.
//                 </Text>
//               </View>
//             )}

//           </View>
//         </View>
//       </ScrollView>

//       {/* Footer Fixo Mobile */}
//       {!isDesktop && (
//         <View style={styles.footerMobile}>
//           <TouchableOpacity
//             style={styles.chatButtonPrimary}
//             onPress={() => router.push('/chat')}
//             activeOpacity={0.85}
//           >
//             <MaterialCommunityIcons name="message-text-outline" size={22} color="#FFF" />
//             <Text style={styles.chatButtonText}>Conversar com o Vendedor</Text>
//           </TouchableOpacity>
//         </View>
//       )}
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#F8FAFC',
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#F8FAFC',
//   },
//   loadingText: {
//     marginTop: 16,
//     color: '#64748B',
//     fontSize: 15,
//     fontWeight: '500',
//   },

//   /* Header Superior */
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 20,
//     paddingVertical: 14,
//     backgroundColor: '#FFFFFF',
//     borderBottomWidth: 1,
//     borderBottomColor: '#E2E8F0',
//     zIndex: 10,
//   },
//   headerLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 1,
//     gap: 14,
//   },
//   headerRight: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//   },
//   headerTitle: {
//     flex: 1,
//     fontSize: 17,
//     fontWeight: '700',
//     color: '#0F172A',
//   },
//   iconButton: {
//     padding: 10,
//     borderRadius: 12,
//     backgroundColor: '#F1F5F9',
//   },

//   /* Estrutura de Layout */
//   scrollContent: {
//     paddingBottom: 100,
//   },
//   scrollContentDesktop: {
//     paddingVertical: 32,
//     alignItems: 'center',
//   },
//   mainLayout: {
//     width: '100%',
//     padding: 16,
//     gap: 24,
//   },
//   mainLayoutDesktop: {
//     maxWidth: 1200,
//     flexDirection: 'row',
//     gap: 32,
//     paddingHorizontal: 24,
//     alignItems: 'flex-start',
//   },

//   sidebar: {
//     width: '100%',
//     gap: 20,
//   },
//   sidebarDesktop: {
//     width: 380,
//   },
//   contentArea: {
//     width: '100%',
//     gap: 20,
//   },
//   contentAreaDesktop: {
//     flex: 1,
//   },

//   /* Card de Perfil do Vendedor */
//   profileCard: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 20,
//     padding: 24,
//     borderWidth: 1,
//     borderColor: '#E2E8F0',
//     alignItems: 'center',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.03,
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   avatarContainer: {
//     position: 'relative',
//     marginBottom: 14,
//   },
//   avatarWrapper: {
//     width: 88,
//     height: 88,
//     borderRadius: 44,
//     backgroundColor: '#DCFCE7',
//     justifyContent: 'center',
//     alignItems: 'center',
//     borderWidth: 3,
//     borderColor: '#86EFAC',
//   },
//   verificationBadge: {
//     position: 'absolute',
//     bottom: 2,
//     right: 2,
//     backgroundColor: '#FFFFFF',
//     borderRadius: 12,
//   },
//   vendedorName: {
//     fontSize: 20,
//     fontWeight: '800',
//     color: '#0F172A',
//     textAlign: 'center',
//   },
//   vendedorTypeBadge: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     backgroundColor: '#DCFCE7',
//     paddingHorizontal: 12,
//     paddingVertical: 5,
//     borderRadius: 16,
//     marginTop: 8,
//     borderWidth: 1,
//     borderColor: '#86EFAC',
//   },
//   vendedorTypeText: {
//     color: '#15803D',
//     fontSize: 11,
//     fontWeight: '700',
//   },
//   locationContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     marginTop: 12,
//   },
//   locationText: {
//     fontSize: 13,
//     color: '#64748B',
//   },
//   emailContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     marginTop: 6,
//   },
//   emailText: {
//     fontSize: 13,
//     color: '#64748B',
//   },

//   /* Avaliação */
//   ratingCard: {
//     width: '100%',
//     backgroundColor: '#F8FAFC',
//     borderRadius: 14,
//     padding: 14,
//     marginTop: 16,
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#F1F5F9',
//     gap: 10,
//   },
//   ratingRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//   },
//   ratingValue: {
//     fontSize: 18,
//     fontWeight: '800',
//     color: '#0F172A',
//   },
//   ratingCount: {
//     fontSize: 12,
//     color: '#64748B',
//   },
//   rateActionButton: {
//     backgroundColor: '#FFFBEB',
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     borderRadius: 10,
//     borderWidth: 1,
//     borderColor: '#FDE68A',
//   },
//   rateActionButtonText: {
//     color: '#D97706',
//     fontSize: 12,
//     fontWeight: '700',
//   },

//   /* Estatísticas Card */
//   statsCard: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 20,
//     padding: 20,
//     borderWidth: 1,
//     borderColor: '#E2E8F0',
//     gap: 16,
//   },
//   statsCardTitle: {
//     fontSize: 15,
//     fontWeight: '700',
//     color: '#0F172A',
//   },
//   statsGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 10,
//   },
//   statBox: {
//     width: '48%',
//     backgroundColor: '#F8FAFC',
//     padding: 12,
//     borderRadius: 12,
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#F1F5F9',
//   },
//   statNumber: {
//     fontSize: 16,
//     fontWeight: '800',
//     color: '#0F172A',
//   },
//   statLabel: {
//     fontSize: 11,
//     color: '#64748B',
//     marginTop: 2,
//     textAlign: 'center',
//   },

//   /* Banner Ecológico */
//   ecoBanner: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#F0FDF4',
//     padding: 16,
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: '#DCFCE7',
//     gap: 14,
//   },
//   ecoBannerIcon: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: '#DCFCE7',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   ecoBannerContent: {
//     flex: 1,
//     gap: 2,
//   },
//   ecoBannerTitle: {
//     fontSize: 14,
//     fontWeight: '700',
//     color: '#15803D',
//   },
//   ecoBannerDesc: {
//     fontSize: 12,
//     color: '#334155',
//     lineHeight: 18,
//   },

//   /* Seção de Anúncios */
//   sectionHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginTop: 8,
//   },
//   sectionTitleGroup: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 10,
//   },
//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: '800',
//     color: '#0F172A',
//   },
//   badgeCounter: {
//     backgroundColor: '#E2E8F0',
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     borderRadius: 10,
//   },
//   badgeCounterText: {
//     fontSize: 12,
//     fontWeight: '700',
//     color: '#475569',
//   },

//   /* Grid de Anúncios */
//   anunciosGrid: {
//     gap: 16,
//   },
//   anunciosGridDesktop: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//   },
//   anuncioCard: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: '#E2E8F0',
//     overflow: 'hidden',
//     flexDirection: 'row',
//   },
//   anuncioCardDesktop: {
//     width: '48.5%',
//     flexDirection: 'column',
//   },
//   anuncioImageWrapper: {
//     width: 120,
//     height: '100%',
//     minHeight: 120,
//     backgroundColor: '#F1F5F9',
//     position: 'relative',
//   },
//   anuncioImage: {
//     width: '100%',
//     height: '100%',
//   },
//   anuncioPlaceholder: {
//     width: '100%',
//     height: '100%',
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#F0FDF4',
//   },
//   anuncioCategoryBadge: {
//     position: 'absolute',
//     top: 8,
//     left: 8,
//     backgroundColor: 'rgba(15, 23, 42, 0.85)',
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 10,
//   },
//   anuncioCategoryText: {
//     color: '#FFFFFF',
//     fontSize: 10,
//     fontWeight: '700',
//   },
//   anuncioBody: {
//     flex: 1,
//     padding: 14,
//     justifyContent: 'space-between',
//     gap: 8,
//   },
//   anuncioTitle: {
//     fontSize: 15,
//     fontWeight: '700',
//     color: '#0F172A',
//     lineHeight: 20,
//   },
//   anuncioQuantityRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//   },
//   anuncioQuantityText: {
//     fontSize: 12,
//     color: '#64748B',
//     fontWeight: '500',
//   },
//   anuncioFooter: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginTop: 4,
//   },
//   anuncioPriceLabel: {
//     fontSize: 10,
//     color: '#64748B',
//     textTransform: 'uppercase',
//   },
//   anuncioPriceValue: {
//     fontSize: 17,
//     fontWeight: '800',
//     color: '#16A34A',
//   },
//   anuncioArrowBtn: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     backgroundColor: '#F0FDF4',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   /* Estado Vazio */
//   emptyContainer: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 20,
//     padding: 40,
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderWidth: 1,
//     borderColor: '#E2E8F0',
//     gap: 12,
//   },
//   emptyTitle: {
//     fontSize: 16,
//     fontWeight: '700',
//     color: '#0F172A',
//   },
//   emptyDesc: {
//     fontSize: 13,
//     color: '#64748B',
//     textAlign: 'center',
//     lineHeight: 20,
//   },

//   /* Botão de Chat Ação Principal */
//   chatButtonPrimary: {
//     backgroundColor: '#16A34A',
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     gap: 10,
//     paddingVertical: 16,
//     borderRadius: 14,
//     width: '100%',
//     marginTop: 10,
//     shadowColor: '#16A34A',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.2,
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   chatButtonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: '700',
//   },

//   /* Footer Mobile Fixo */
//   footerMobile: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     backgroundColor: '#FFFFFF',
//     paddingHorizontal: 20,
//     paddingVertical: 14,
//     borderTopWidth: 1,
//     borderTopColor: '#E2E8F0',
//     elevation: 10,
//   },
// });