import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, resolveProfileImageUrl } from '../config/api';
import { clearSessionToken, getSessionToken } from '../config/session';

// Tipo para os dados do usuário
interface Usuario {
  id_usuario: number;
  usuario_nome: string;
  email: string;
  tipo: string;
  cpf_cnpj?: string | null;
  foto_perfil?: string | null;
  data_cadastro?: string;
}

// Componente para cada item de menu
function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
  showChevron = Boolean(onPress),
  rightElement,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={styles.menuIconCircle}>
        <MaterialCommunityIcons name={icon} size={21} color="#2E7D32" />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement ? (
        rightElement
      ) : showChevron ? (
        <MaterialCommunityIcons name="chevron-right" size={20} color="#9AA69C" />
      ) : null}
    </TouchableOpacity>
  );
}

// Componente para o título de cada seção
function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [modoEscuro, setModoEscuro] = useState(false);

  const API_URL = API_BASE_URL;

  const carregarPerfil = useCallback(async () => {
    try {
      // Busca o ID do usuário salvo no AsyncStorage
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');

      if (!dadosSalvos) {
        // Se não há sessão, redireciona para o login
        router.replace('/');
        return;
      }

      const usuarioLocal: Usuario = JSON.parse(dadosSalvos);

      // Busca os dados atualizados do servidor
      const response = await fetch(`${API_URL}/usuario/${usuarioLocal.id_usuario}`);

      if (response.ok) {
        const dadosAtualizados: Usuario = await response.json();
        dadosAtualizados.foto_perfil = resolveProfileImageUrl(dadosAtualizados.foto_perfil);
        setUsuario(dadosAtualizados);
        // Atualiza o cache local
        await AsyncStorage.setItem('@usuario_logado', JSON.stringify(dadosAtualizados));
      } else {
        // Usa os dados locais como fallback
        setUsuario(usuarioLocal);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      // Tenta usar dados do cache em caso de erro de rede
      try {
        const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
        if (dadosSalvos) {
          setUsuario(JSON.parse(dadosSalvos));
        }
      } catch {
        // Silencia erro do cache
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void carregarPerfil();
    }, [carregarPerfil])
  );

  const handleLogout = async () => {
    const executarLogout = async () => {
      const token = await getSessionToken();
      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/usuario/sessao-atual`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            console.error('O servidor não confirmou o encerramento da sessão atual.');
          }
        } catch (error) {
          console.error('Não foi possível encerrar a sessão no servidor:', error);
        }
      }
      await AsyncStorage.removeItem('@usuario_logado');
      await clearSessionToken();
      router.replace('/');
    };

    if (Platform.OS === 'web') {
      if (confirm('Deseja realmente sair da sua conta?')) {
        await executarLogout();
      }
    } else {
      Alert.alert(
        'Sair da Conta',
        'Deseja realmente sair da sua conta?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sair',
            style: 'destructive',
            onPress: executarLogout,
          },
        ]
      );
    }
  };

  const handleVoltar = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Se não houver histórico, volta forçosamente para a tela principal (home)
      router.replace('/home' as any); 
    }
  };

  // Formata o tipo de usuário para exibição
  const formatarTipo = (tipo: string) => {
    const tipos: Record<string, string> = {
      catador: 'Catador',
      cooperativa: 'Cooperativa',
      industria: 'Indústria',
      empresa: 'Empresa',
      consumidor: 'Consumidor',
      admin: 'Administrador',
    };
    return tipos[tipo] || tipo || 'Não definido';
  };

  // Formata a data de cadastro
  const formatarData = (dataStr?: string) => {
    if (!dataStr) return '';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Gera as iniciais do nome para o avatar
  const getIniciais = (nome: string) => {
    const partes = nome.trim().split(' ');
    if (partes.length >= 2) {
      return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        onPress={handleVoltar}
        style={styles.backButton}
        accessibilityLabel="Voltar"
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* O título rola com o conteúdo; apenas a seta fica fixa. */}
        <View style={styles.topBar}>
          <View style={styles.headerSpacer} />
          <Text style={styles.topBarTitle}>Meu Perfil</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Card do perfil do usuário */}
        <View style={styles.profileCard}>
          <View style={styles.avatarGradient}>
            <View style={styles.avatar}>
              {usuario?.foto_perfil ? (
                <Image source={{ uri: usuario.foto_perfil }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {usuario ? getIniciais(usuario.usuario_nome) : '??'}
                </Text>
              )}
            </View>
          </View>

          <Text style={styles.userName}>{usuario?.usuario_nome || 'Usuário'}</Text>
          <Text style={styles.userEmail}>{usuario?.email || ''}</Text>

          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{formatarTipo(usuario?.tipo || '')}</Text>
            </View>
          </View>

          {usuario?.data_cadastro && (
            <Text style={styles.memberSince}>
              Membro desde {formatarData(usuario.data_cadastro)}
            </Text>
          )}
        </View>

        {/* Seção: Configurações do Perfil */}
        <SectionTitle title="Perfil" />
        <View style={styles.menuSection}>
          <MenuItem
            icon="account-edit-outline"
            label="Editar Perfil"
            subtitle="Atualize seus dados e sua foto"
            onPress={() => router.push('/editar_perfil')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="map-marker-outline"
            label="Meus Endereços"
            subtitle="Gerencie seus endereços de coleta"
            onPress={() => router.push('/enderecos')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="heart-outline"
            iconColor="#D32F2F"
            label="Meus Favoritos"
            subtitle="Anúncios salvos para depois"
            onPress={() => router.push('/favoritos')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="star-outline"
            label="Minhas Avaliações"
            subtitle="Avaliações recebidas e enviadas"
            onPress={() => router.push('/minhas_avaliacoes')} 
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="gift-outline"
            iconColor="#F57C00"
            label="Minhas Recompensas"
            subtitle="Troque seus EcoPontos por benefícios"
            onPress={() => router.push('/recompensas' as any)}
          />
        </View>

        {/* Seção: Configurações da Conta */}
        <SectionTitle title="Conta" />
        <View style={styles.menuSection}>
          <MenuItem
            icon="lock-outline"
            label="Alterar Senha"
            subtitle="Altere sua senha de acesso"
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="shield-check-outline"
            label="Privacidade e Segurança"
            subtitle="Gerencie sessões e sua conta"
            onPress={() => router.push('/privacidade_seguranca')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="credit-card-outline"
            label="Plano e Assinatura"
            subtitle="Consulte seu plano atual"
          />
        </View>

        {/* Seção: Configurações do App */}
        <SectionTitle title="Aplicativo" />
        <View style={styles.menuSection}>
          <MenuItem
            icon="bell-outline"
            label="Notificações"
            subtitle="Escolha quais alertas deseja receber"
            onPress={() => router.push('/notificacoes')}
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="theme-light-dark"
            label="Modo Escuro"
            subtitle={modoEscuro ? 'Ativado' : 'Desativado'}
            showChevron={false}
            rightElement={
              <Switch
                value={modoEscuro}
                onValueChange={setModoEscuro}
                trackColor={{ false: '#CFD8DC', true: '#A5D6A7' }}
                thumbColor={modoEscuro ? '#2E7D32' : '#90A4AE'}
              />
            }
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="translate"
            label="Idioma"
            subtitle="Português (Brasil)"
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="help-circle-outline"
            label="Ajuda e Suporte"
            subtitle="Perguntas frequentes e contato"
          />
          <View style={styles.menuDivider} />
          <MenuItem
            icon="information-outline"
            label="Sobre o App"
            subtitle="Versão 1.0.0"
          />
        </View>

        {/* Botão de Sair */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <MaterialCommunityIcons name="logout" size={20} color="#D32F2F" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#666',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 14,
    backgroundColor: '#F4F9F4',
  },
  backButton: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    top: Platform.OS === 'android' ? 40 : 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
  },

  // Profile Card
  profileCard: {
    marginHorizontal: 20,
    marginTop: 6,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#E8F5E9',
  },
  avatarGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    elevation: 4,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#43A047',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#78909C',
    marginBottom: 12,
  },
  badgeContainer: {
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
  },
  memberSince: {
    fontSize: 12,
    color: '#B0BEC5',
    marginTop: 4,
  },

  // Section Title
  sectionTitleContainer: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 9,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B5E20',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Menu Section
  menuSection: {
    marginHorizontal: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F4F0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263238',
  },
  menuSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: '#718075',
    marginTop: 3,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E8F0E8',
    marginLeft: 64,
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    gap: 8,
  },
  logoutText: {
    color: '#D32F2F',
    fontWeight: 'bold',
    fontSize: 16,
  },
});