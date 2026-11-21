import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { clearSessionToken, getSessionToken } from '../config/session';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Usuario {
  id_usuario: number;
  usuario_nome: string;
  foto_perfil?: string | null;
}

interface Anuncio {
  id_anuncio: number;
  anuncio_titulo: string;
  quantidade: number;
  preco: number;
  material_nome: string;
  categoria: string;
  unidade_medida: string;
  imagem_capa: string | null;
}

interface Coleta {
  id_coleta: number;
  data_coleta: string | null;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  material_nome: string;
  quantidade: number;
  unidade_medida: string;
  logradouro: string | null;
  cidade: string | null;
}

// Paleta EcoTech Premium
const C = {
  bg: '#F3F7F4',
  surface: '#FFFFFF',
  ink: '#0E2A1F',
  muted: '#5B7266',
  line: '#DCE7E0',
  forest: '#0F3D2E',
  brand: '#2E7D32',
  signal: '#B8E65C',
  signalInk: '#12310A',
  chip: '#E4EFE8',
};

const TINT_CATEGORIA: Record<string, { bg: string; icon: IconName }> = {
  Papel: { bg: '#E9F0DA', icon: 'file-document-outline' },
  Plástico: { bg: '#DDEEF3', icon: 'bottle-soda-outline' },
  Vidro: { bg: '#D9F0E8', icon: 'glass-fragile' },
  Metal: { bg: '#E8E8EE', icon: 'cog-outline' },
  Eletrônicos: { bg: '#F3E6D8', icon: 'power-plug-outline' },
};

const ATALHOS: { label: string; icon: IconName; rota: string }[] = [
  { label: 'Coletas', icon: 'truck-delivery-outline', rota: '/coleta' },
  { label: 'Mensagens', icon: 'message-text-outline', rota: '/conversas' },
  { label: 'Transações', icon: 'handshake-outline', rota: '/transacoes' },
  { label: 'Ecopontos', icon: 'map-marker-radius-outline', rota: '/ecopontos' },
  { label: 'Recompensas', icon: 'gift-outline', rota: '/recompensas' },
  { label: 'Favoritos', icon: 'heart-outline', rota: '/favoritos' },
];

const formatarPreco = (valor: number) =>
  Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarQuantidade = (valor: number) =>
  Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const formatarData = (iso: string | null) => {
  if (!iso) return 'Data a combinar';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Data a combinar';
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia}, ${hora}`;
};

const iniciais = (nome: string) =>
  nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export default function HomeScreen() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [proximaColeta, setProximaColeta] = useState<Coleta | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const salvo = await AsyncStorage.getItem('@usuario_logado');
      const user: Usuario | null = salvo ? JSON.parse(salvo) : null;
      setUsuario(user);

      const [resAnuncios, resColetas] = await Promise.all([
        fetch(`${API_BASE_URL}/anuncios`),
        user ? fetch(`${API_BASE_URL}/coletas/usuario/${user.id_usuario}`) : Promise.resolve(null),
      ]);

      if (resAnuncios.ok) {
        const lista: Anuncio[] = await resAnuncios.json();
        setAnuncios(lista.slice(0, 8));
      }
      if (resColetas && resColetas.ok) {
        const coletas: Coleta[] = await resColetas.json();
        const abertas = coletas
          .filter((c) => c.status === 'agendada' || c.status === 'em_andamento')
          .sort((a, b) => {
            const ta = a.data_coleta ? new Date(a.data_coleta).getTime() : Infinity;
            const tb = b.data_coleta ? new Date(b.data_coleta).getTime() : Infinity;
            return ta - tb;
          });
        setProximaColeta(abertas[0] ?? null);
      }
    } catch (error) {
      console.error('Erro ao carregar a página inicial:', error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const handleLogout = async () => {
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

  const primeiroNome = usuario?.usuario_nome?.split(' ')[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Topo */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Abrir meu perfil"
          >
            {usuario?.foto_perfil ? (
              <Image source={{ uri: usuario.foto_perfil }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{usuario ? iniciais(usuario.usuario_nome) : '?'}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.hello}>Olá{primeiroNome ? `, ${primeiroNome}` : ''}</Text>
            <Text style={styles.sub}>O que vamos reaproveitar hoje?</Text>
          </View>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push('/notificacoes')}
            accessibilityRole="button"
            accessibilityLabel="Abrir notificações"
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Destaque principal */}
        <View style={styles.hero}>
          <View style={styles.heroRing} />
          <Text style={styles.heroTitle}>Tem material parado em casa ou na empresa?</Text>
          <Text style={styles.heroText}>
            Anuncie papel, vidro, metal e mais. Quem precisa entra em contato pelo chat.
          </Text>
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroPrimary}
              activeOpacity={0.85}
              onPress={() => router.push('/anuncio_cadastro')}
            >
              <MaterialCommunityIcons name="plus" size={20} color={C.signalInk} />
              <Text style={styles.heroPrimaryText}>Criar anúncio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroSecondary}
              activeOpacity={0.85}
              onPress={() => router.push('/anuncio_listagem')}
            >
              <Text style={styles.heroSecondaryText}>Ver anúncios</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Próxima coleta (só aparece quando existe) */}
        {proximaColeta && (
          <TouchableOpacity
            style={styles.coleta}
            activeOpacity={0.85}
            onPress={() => router.push('/coleta')}
          >
            <View style={styles.coletaIcon}>
              <MaterialCommunityIcons name="calendar-clock-outline" size={22} color={C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coletaTitle}>
                {proximaColeta.material_nome} · {formatarQuantidade(proximaColeta.quantidade)}{' '}
                {proximaColeta.unidade_medida}
              </Text>
              <Text style={styles.coletaSub} numberOfLines={1}>
                {formatarData(proximaColeta.data_coleta)}
                {proximaColeta.logradouro ? ` · ${proximaColeta.logradouro}` : ''}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={C.muted} />
          </TouchableOpacity>
        )}

        {/* Atalhos */}
        <View style={styles.shortcuts}>
          {ATALHOS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.shortcut}
              activeOpacity={0.75}
              onPress={() => router.push(a.rota as never)}
              accessibilityRole="button"
              accessibilityLabel={a.label}
            >
              <View style={styles.shortcutIcon}>
                <MaterialCommunityIcons name={a.icon} size={24} color={C.forest} />
              </View>
              <Text style={styles.shortcutLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Anúncios recentes */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Anúncios recentes</Text>
          <TouchableOpacity onPress={() => router.push('/anuncio_listagem')}>
            <Text style={styles.sectionLink}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {carregando ? (
          <ActivityIndicator color={C.brand} style={{ marginVertical: 24 }} />
        ) : anuncios.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Ainda não há anúncios ativos. Seja o primeiro a anunciar um material.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carousel}
          >
            {anuncios.map((a) => {
              const tint = TINT_CATEGORIA[a.categoria] ?? { bg: C.chip, icon: 'recycle' as IconName };
              return (
                <TouchableOpacity
                  key={a.id_anuncio}
                  style={styles.adCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    router.push({ pathname: '/anuncio_detalhes', params: { id: a.id_anuncio } })
                  }
                >
                  <View style={[styles.adThumb, { backgroundColor: tint.bg }]}>
                    {a.imagem_capa ? (
                      <Image source={{ uri: a.imagem_capa }} style={styles.adImage} />
                    ) : (
                      <MaterialCommunityIcons name={tint.icon} size={34} color={C.forest} />
                    )}
                    <View style={styles.adTag}>
                      <Text style={styles.adTagText}>{a.categoria}</Text>
                    </View>
                  </View>
                  <View style={styles.adBody}>
                    <Text style={styles.adTitle} numberOfLines={1}>
                      {a.anuncio_titulo}
                    </Text>
                    <Text style={styles.adQty}>
                      {formatarQuantidade(a.quantidade)}
                      <Text style={styles.adUnit}> {a.unidade_medida}</Text>
                    </Text>
                    <Text style={styles.adPrice}>{formatarPreco(a.preco)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.logout} onPress={handleLogout} accessibilityRole="button">
          <MaterialCommunityIcons name="logout" size={18} color="#B3261E" />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const cardShadow = Platform.select({
  ios: { shadowColor: '#0F3D2E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14 },
  android: { elevation: 2 },
  default: {},
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, marginTop: 4 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.forest,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: C.signal, fontWeight: '700', fontSize: 16 },
  headerText: { flex: 1 },
  hello: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  sub: { fontSize: 14, color: C.muted, marginTop: 1 },
  bell: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
  },

  hero: {
    backgroundColor: C.forest, borderRadius: 24, padding: 24, overflow: 'hidden', marginBottom: 14,
  },
  heroRing: {
    position: 'absolute', right: -70, top: -70, width: 220, height: 220, borderRadius: 110,
    borderWidth: 1, borderColor: 'rgba(184,230,92,0.30)', backgroundColor: 'rgba(184,230,92,0.05)',
  },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#EAF5EE', letterSpacing: -0.5, lineHeight: 29, maxWidth: '88%' },
  heroText: { fontSize: 14, color: '#B7D2C2', marginTop: 10, lineHeight: 20 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap' },
  heroPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.signal,
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999,
  },
  heroPrimaryText: { color: C.signalInk, fontWeight: '700', fontSize: 15 },
  heroSecondary: {
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(234,245,238,0.35)',
  },
  heroSecondaryText: { color: '#EAF5EE', fontWeight: '600', fontSize: 15 },

  coleta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface,
    borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line, marginBottom: 14,
  },
  coletaIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: C.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  coletaTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  coletaSub: { fontSize: 13, color: C.muted, marginTop: 2 },

  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 8, rowGap: 14 },
  shortcut: { width: '33.333%', alignItems: 'center', gap: 8 },
  shortcutIcon: {
    width: 60, height: 60, borderRadius: 20, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...cardShadow,
  },
  shortcutLabel: { fontSize: 13, fontWeight: '600', color: C.ink },

  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginTop: 20, marginBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  sectionLink: { fontSize: 14, fontWeight: '600', color: C.brand },

  carousel: { gap: 12, paddingRight: 20 },
  adCard: {
    width: 168, backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: C.line,
  },
  adThumb: { height: 104, alignItems: 'center', justifyContent: 'center' },
  adImage: { width: '100%', height: '100%' },
  adTag: {
    position: 'absolute', top: 10, left: 10, backgroundColor: C.surface,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
  },
  adTagText: { fontSize: 11, fontWeight: '700', color: C.ink },
  adBody: { padding: 12, gap: 4 },
  adTitle: { fontSize: 15, fontWeight: '700', color: C.ink, textTransform: 'capitalize' },
  adQty: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.5 },
  adUnit: { fontSize: 13, fontWeight: '500', color: C.muted },
  adPrice: { fontSize: 15, fontWeight: '700', color: C.brand },

  empty: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, borderRadius: 18,
    padding: 24, alignItems: 'center',
  },
  emptyText: { color: C.muted, textAlign: 'center', fontSize: 14 },

  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 32, padding: 12,
  },
  logoutText: { color: '#B3261E', fontWeight: '600', fontSize: 15 },
});