import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import EcopontoMap from '../components/ecopontos/EcopontoMap';
import CidadeSearchBar from '../components/ecopontos/CidadeSearchBar';
import MaterialFilterChips from '../components/ecopontos/MaterialFilterChips';
import EcopontoListItem from '../components/ecopontos/EcopontoListItem';
import EcopontoDetalhes from '../components/ecopontos/EcopontoDetalhes';
import { BREAKPOINT_DESKTOP, CORES, TIPOS } from '../components/ecopontos/constantes';
import { criarFoco, enquadrarPontos, FOCO_BRASIL, type FocoMapa } from '../components/ecopontos/geo';
import { useLocalizacaoUsuario } from '../hooks/useLocalizacaoUsuario';
import {
  buscarCidadeDoEnderecoCadastrado,
  buscarCidades,
  identificarCidade,
  listarEcopontos,
  obterPermissao,
  type Cidade,
  type Coordenada,
  type Ecoponto,
  type MaterialCodigo,
  type PermissaoEcopontos,
} from '../services/ecopontosService';

const RAIO_PROXIMOS_KM = 50;

/** O que o mapa está mostrando no momento. */
type Contexto = { observacao?: string } & (
  | { tipo: 'cidade'; cidade: Cidade }
  | { tipo: 'proximos'; centro: Coordenada }
  | { tipo: 'todos' }
);

function rotuloContexto(contexto: Contexto | null) {
  if (!contexto) return 'Localizando...';
  if (contexto.tipo === 'cidade') return `${contexto.cidade.nome} - ${contexto.cidade.estado}`;
  if (contexto.tipo === 'proximos') return 'Perto de você';
  return 'Todas as cidades';
}

export default function EcopontosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const desktop = width >= BREAKPOINT_DESKTOP;

  const { coordenada: usuario, status: statusLocalizacao, solicitar } = useLocalizacaoUsuario();
  const usuarioRef = useRef<Coordenada | null>(null);
  useEffect(() => {
    usuarioRef.current = usuario;
  }, [usuario]);

  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [materiais, setMateriais] = useState<MaterialCodigo[]>([]);
  const [ecopontos, setEcopontos] = useState<Ecoponto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Ecoponto | null>(null);
  const [foco, setFoco] = useState<FocoMapa>(() => criarFoco(FOCO_BRASIL));
  const [listaAberta, setListaAberta] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [permissao, setPermissao] = useState<PermissaoEcopontos | null>(null);
  const primeiroFocoRef = useRef(true);
  const ajustarFocoRef = useRef(true);
  const listaRef = useRef<FlatList<Ecoponto>>(null);

  const definirContexto = useCallback((novo: Contexto) => {
    ajustarFocoRef.current = true;
    setSelecionado(null);
    setContexto(novo);
  }, []);

  // GPS → cidade atual. Sem GPS: cidade do endereço cadastrado. Sem nada: todos os pontos.
  const localizarUsuario = useCallback(async () => {
    setCarregando(true);
    const coords = await solicitar();
    if (coords) {
      try {
        const cidade = await identificarCidade(coords);
        definirContexto({ tipo: 'cidade', cidade });
      } catch {
        definirContexto({ tipo: 'proximos', centro: coords });
      }
      return;
    }

    try {
      const salvo = await AsyncStorage.getItem('@usuario_logado');
      const idUsuario: number | undefined = salvo ? JSON.parse(salvo)?.id_usuario : undefined;
      if (idUsuario) {
        const endereco = await buscarCidadeDoEnderecoCadastrado(idUsuario);
        if (endereco) {
          const sugestoes = await buscarCidades(endereco.cidade);
          const cidade = sugestoes.find((c) => c.estado === endereco.estado.toUpperCase());
          if (cidade) {
            definirContexto({
              tipo: 'cidade',
              cidade,
              observacao: 'Localização indisponível — mostrando a cidade do seu endereço cadastrado.',
            });
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Não foi possível usar o endereço cadastrado:', e);
    }

    definirContexto({
      tipo: 'todos',
      observacao: 'Ative a localização ou pesquise uma cidade para ver os pontos de coleta perto de você.',
    });
  }, [solicitar, definirContexto]);

  useEffect(() => {
    void localizarUsuario();
  }, [localizarUsuario]);

  // Ao voltar para a tela (ex.: depois de cadastrar/editar um ponto) recarrega do banco
  useFocusEffect(
    useCallback(() => {
      void obterPermissao().then(setPermissao);
      if (primeiroFocoRef.current) {
        primeiroFocoRef.current = false;
        return;
      }
      setTentativa((t) => t + 1);
    }, []),
  );

  // Carrega os pontos sempre que o contexto ou os filtros mudam
  useEffect(() => {
    if (!contexto) return;
    const controle = new AbortController();
    let ativo = true;

    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        let lista: Ecoponto[] = [];
        let novoAviso: string | null = contexto.observacao ?? null;
        let padrao: Coordenada & { zoom: number } = FOCO_BRASIL;
        const sufixoFiltro = materiais.length ? ' para os materiais selecionados' : '';

        if (contexto.tipo === 'cidade') {
          const { cidade } = contexto;
          padrao = { latitude: cidade.latitude, longitude: cidade.longitude, zoom: 12 };
          lista = await listarEcopontos(
            { cidade: cidade.nome, estado: cidade.estado, referencia: usuarioRef.current ?? cidade, materiais },
            controle.signal,
          );
          if (lista.length === 0) {
            const proximos = await listarEcopontos(
              { referencia: cidade, raioKm: RAIO_PROXIMOS_KM, materiais },
              controle.signal,
            );
            if (proximos.length > 0) {
              lista = proximos;
              novoAviso = `Nenhum ponto em ${cidade.nome}${sufixoFiltro}. Mostrando os mais próximos (até ${RAIO_PROXIMOS_KM} km).`;
            } else {
              novoAviso = `Nenhum ponto de coleta encontrado em ${cidade.nome} - ${cidade.estado}${sufixoFiltro}.`;
            }
          }
        } else if (contexto.tipo === 'proximos') {
          padrao = { ...contexto.centro, zoom: 12 };
          lista = await listarEcopontos(
            { referencia: contexto.centro, raioKm: RAIO_PROXIMOS_KM, materiais },
            controle.signal,
          );
          if (lista.length === 0) novoAviso = `Nenhum ponto de coleta em até ${RAIO_PROXIMOS_KM} km${sufixoFiltro}.`;
        } else {
          lista = await listarEcopontos({ materiais, referencia: usuarioRef.current }, controle.signal);
        }

        if (!ativo) return;
        setEcopontos(lista);
        setAviso(novoAviso);
        setSelecionado((atual) => (atual && lista.some((p) => p.id_ecoponto === atual.id_ecoponto) ? atual : null));
        if (ajustarFocoRef.current) {
          ajustarFocoRef.current = false;
          setFoco(criarFoco(enquadrarPontos(lista, padrao)));
        }
      } catch (e) {
        if (!ativo || controle.signal.aborted) return;
        console.error('Erro ao carregar ecopontos:', e);
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar os ecopontos.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
      controle.abort();
    };
  }, [contexto, materiais, tentativa]);

  const selecionarPonto = useCallback(
    (ponto: Ecoponto, centralizar = false) => {
      setSelecionado(ponto);
      if (centralizar) setFoco(criarFoco({ latitude: ponto.latitude, longitude: ponto.longitude, zoom: 15 }));
      if (desktop) listaRef.current?.scrollToOffset({ offset: 0, animated: true });
      else setListaAberta(false);
    },
    [desktop],
  );

  const selecionarDaLista = useCallback((ponto: Ecoponto) => selecionarPonto(ponto, true), [selecionarPonto]);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const abrirCadastro = (id?: number) =>
    router.push(id ? { pathname: '/ecoponto_cadastro', params: { id: String(id) } } : '/ecoponto_cadastro');
  const podeEditar = (ponto: Ecoponto) =>
    !!permissao && (permissao.admin || ponto.id_usuario_cadastro === permissao.id_usuario);
  const detalhesSelecionado = selecionado ? (
    <EcopontoDetalhes
      ecoponto={selecionado}
      onFechar={() => setSelecionado(null)}
      onEditar={podeEditar(selecionado) ? () => abrirCadastro(selecionado.id_ecoponto) : undefined}
    />
  ) : null;

  const rotulo = rotuloContexto(contexto);
  const resumo = carregando
    ? 'Buscando pontos de coleta...'
    : `${ecopontos.length} ponto${ecopontos.length === 1 ? '' : 's'} de coleta`;
  const obtendoLocalizacao = !contexto && statusLocalizacao === 'carregando';

  // ---------------------------------------------------------------------------
  // Blocos reutilizados nos dois layouts
  // ---------------------------------------------------------------------------

  const cabecalho = (
    <View style={styles.topBar}>
      <Pressable onPress={voltar} style={styles.botaoRedondo} accessibilityLabel="Voltar">
        <MaterialCommunityIcons name="arrow-left" size={24} color={CORES.primariaEscura} />
      </Pressable>
      <View style={styles.topBarTextos}>
        <Text style={styles.topBarTitulo}>Ecopontos</Text>
        <Text style={styles.topBarSubtitulo} numberOfLines={1}>
          {rotulo}
        </Text>
      </View>
      {permissao?.pode_cadastrar ? (
        <Pressable
          onPress={() => abrirCadastro()}
          style={styles.botaoRedondo}
          accessibilityLabel="Cadastrar ponto de coleta"
        >
          <MaterialCommunityIcons name="plus" size={24} color={CORES.primaria} />
        </Pressable>
      ) : (
        <View style={styles.botaoRedondoVazio} />
      )}
    </View>
  );

  const busca = (
    <View style={styles.busca}>
      <CidadeSearchBar
        onSelecionar={(cidade) => definirContexto({ tipo: 'cidade', cidade })}
        valorAtual={contexto?.tipo === 'cidade' ? rotulo : undefined}
      />
    </View>
  );

  const faixaAviso =
    erro || aviso ? (
      <View style={[styles.aviso, erro ? styles.avisoErro : null]}>
        <MaterialCommunityIcons
          name={erro ? 'alert-circle-outline' : 'information-outline'}
          size={18}
          color={erro ? CORES.erro : CORES.primariaEscura}
        />
        <Text style={[styles.avisoTexto, erro ? { color: CORES.erro } : null]}>{erro ?? aviso}</Text>
        {erro && (
          <Pressable onPress={() => setTentativa((t) => t + 1)} hitSlop={8}>
            <Text style={styles.avisoAcao}>Tentar de novo</Text>
          </Pressable>
        )}
      </View>
    ) : null;

  const listaVazia = !carregando ? (
    <View style={styles.vazio}>
      <MaterialCommunityIcons name="map-search-outline" size={36} color={CORES.textoTerciario} />
      <Text style={styles.vazioTexto}>Nenhum ponto de coleta cadastrado aqui.</Text>
      {permissao?.pode_cadastrar && (
        <Pressable onPress={() => abrirCadastro()} style={styles.vazioBotao}>
          <MaterialCommunityIcons name="map-marker-plus-outline" size={18} color={CORES.branco} />
          <Text style={styles.vazioBotaoTexto}>Cadastrar ponto</Text>
        </Pressable>
      )}
    </View>
  ) : null;

  const mapa = (
    <View style={styles.mapa}>
      <EcopontoMap
        ecopontos={ecopontos}
        foco={foco}
        localizacaoUsuario={usuario}
        selecionadoId={selecionado?.id_ecoponto ?? null}
        onSelecionar={selecionarPonto}
      />

      <View style={[styles.legenda, desktop ? styles.legendaDesktop : styles.legendaMobile]} pointerEvents="none">
        {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((tipo) => (
          <View key={tipo} style={styles.legendaItem}>
            <View style={[styles.legendaCor, { backgroundColor: TIPOS[tipo].cor }]} />
            <Text style={styles.legendaTexto}>{TIPOS[tipo].label}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => void localizarUsuario()}
        style={({ pressed }) => [styles.botaoLocalizar, pressed && { opacity: 0.8 }]}
        accessibilityLabel="Ir para minha localização"
      >
        {statusLocalizacao === 'carregando' ? (
          <ActivityIndicator size="small" color={CORES.primaria} />
        ) : (
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={CORES.primaria} />
        )}
      </Pressable>

      {(carregando || obtendoLocalizacao) && (
        <View style={styles.carregandoPilula} pointerEvents="none">
          <ActivityIndicator size="small" color={CORES.branco} />
          <Text style={styles.carregandoTexto}>
            {obtendoLocalizacao ? 'Obtendo sua localização...' : 'Carregando pontos...'}
          </Text>
        </View>
      )}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Desktop / telas largas: painel lateral + mapa
  // ---------------------------------------------------------------------------
  if (desktop) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.linhaDesktop}>
          <View style={styles.painelLateral}>
            {cabecalho}
            {busca}
            <View style={styles.filtrosDesktop}>
              <Text style={styles.rotuloSecao}>Materiais aceitos</Text>
              <MaterialFilterChips selecionados={materiais} onChange={setMateriais} layout="wrap" />
            </View>
            <FlatList
              ref={listaRef}
              style={styles.listaDesktop}
              contentContainerStyle={styles.listaConteudo}
              data={ecopontos}
              keyExtractor={(item) => String(item.id_ecoponto)}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View style={styles.cabecalhoLista}>
                  {faixaAviso}
                  {detalhesSelecionado}
                  <Text style={styles.resumo}>{resumo}</Text>
                </View>
              }
              ListEmptyComponent={listaVazia}
              renderItem={({ item }) => (
                <EcopontoListItem
                  ecoponto={item}
                  selecionado={item.id_ecoponto === selecionado?.id_ecoponto}
                  onPress={selecionarDaLista}
                />
              )}
            />
          </View>
          {mapa}
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Mobile: busca no topo, mapa em tela cheia e painel inferior recolhível
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {cabecalho}
      {busca}
      <MaterialFilterChips selecionados={materiais} onChange={setMateriais} />
      {faixaAviso && <View style={styles.avisoMobile}>{faixaAviso}</View>}

      {mapa}

      <View style={[styles.painelInferior, { paddingBottom: insets.bottom + 8, maxHeight: height * 0.6 }]}>
        {selecionado ? (
          <ScrollView contentContainerStyle={styles.painelConteudo}>
            {detalhesSelecionado}
          </ScrollView>
        ) : (
          <>
            <Pressable
              onPress={() => setListaAberta((aberta) => !aberta)}
              style={styles.painelCabecalho}
              accessibilityRole="button"
              accessibilityLabel={listaAberta ? 'Recolher lista' : 'Ver lista de pontos'}
            >
              <View style={styles.alca} />
              <View style={styles.painelCabecalhoLinha}>
                <Text style={styles.resumo}>
                  {resumo}
                  {contexto && !carregando ? ` · ${rotulo}` : ''}
                </Text>
                <MaterialCommunityIcons
                  name={listaAberta ? 'chevron-down' : 'chevron-up'}
                  size={22}
                  color={CORES.textoSecundario}
                />
              </View>
            </Pressable>
            {listaAberta && (
              <FlatList
                ref={listaRef}
                style={{ maxHeight: height * 0.42 }}
                contentContainerStyle={styles.painelLista}
                data={ecopontos}
                keyExtractor={(item) => String(item.id_ecoponto)}
                ListEmptyComponent={listaVazia}
                renderItem={({ item }) => <EcopontoListItem ecoponto={item} onPress={selecionarDaLista} />}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const sombra = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 4,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  botaoRedondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CORES.fundoClaro,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoRedondoVazio: { width: 40 },
  topBarTextos: { flex: 1, alignItems: 'center' },
  topBarTitulo: { fontSize: 18, fontWeight: 'bold', color: CORES.primariaEscura },
  topBarSubtitulo: { fontSize: 13, color: CORES.textoSecundario, marginTop: 1 },

  busca: { paddingHorizontal: 16, zIndex: 20 },

  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CORES.fundoSuave,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avisoErro: { backgroundColor: '#FFEBEE' },
  avisoTexto: { flex: 1, fontSize: 13, color: CORES.primariaEscura, lineHeight: 18 },
  avisoAcao: { fontSize: 13, fontWeight: '700', color: CORES.erro, textDecorationLine: 'underline' },
  avisoMobile: { paddingHorizontal: 16, paddingBottom: 8 },

  // Mapa
  mapa: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#E8EEE8' },
  botaoLocalizar: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CORES.branco,
    alignItems: 'center',
    justifyContent: 'center',
    ...sombra,
  },
  carregandoPilula: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(27, 94, 32, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  carregandoTexto: { color: CORES.branco, fontSize: 13, fontWeight: '600' },
  legenda: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    ...sombra,
  },
  legendaMobile: { top: 12, left: 12 },
  legendaDesktop: { bottom: 24, left: 12 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaCor: { width: 10, height: 10, borderRadius: 5 },
  legendaTexto: { fontSize: 12, color: CORES.texto },

  // Desktop
  linhaDesktop: { flex: 1, flexDirection: 'row' },
  painelLateral: {
    width: 400,
    maxWidth: '45%',
    backgroundColor: CORES.fundo,
    borderRightWidth: 1,
    borderRightColor: CORES.borda,
    zIndex: 2,
  },
  filtrosDesktop: { paddingHorizontal: 16, paddingTop: 14, gap: 8 },
  rotuloSecao: { fontSize: 13, fontWeight: '600', color: CORES.textoSecundario },
  listaDesktop: { flex: 1 },
  listaConteudo: { paddingHorizontal: 12, paddingBottom: 24 },
  cabecalhoLista: { gap: 12, paddingTop: 14, paddingHorizontal: 4, paddingBottom: 4 },
  resumo: { fontSize: 14, fontWeight: '600', color: CORES.textoSecundario },

  // Mobile – painel inferior
  painelInferior: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -16,
    ...sombra,
    shadowOffset: { width: 0, height: -2 },
  },
  painelCabecalho: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  alca: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: CORES.borda,
    marginBottom: 8,
  },
  painelCabecalhoLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  painelConteudo: { padding: 12 },
  painelLista: { paddingHorizontal: 8, paddingBottom: 8 },

  vazio: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  vazioTexto: { fontSize: 14, color: CORES.textoSecundario, textAlign: 'center' },
  vazioBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CORES.primaria,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
  },
  vazioBotaoTexto: { color: CORES.branco, fontWeight: '700', fontSize: 14 },
});
