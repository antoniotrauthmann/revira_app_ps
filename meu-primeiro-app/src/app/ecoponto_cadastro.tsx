import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import EcopontoMap from '../components/ecopontos/EcopontoMap';
import CidadeSearchBar from '../components/ecopontos/CidadeSearchBar';
import MaterialFilterChips from '../components/ecopontos/MaterialFilterChips';
import { BREAKPOINT_DESKTOP, CORES, STATUS, TIPOS } from '../components/ecopontos/constantes';
import { criarFoco, FOCO_BRASIL, type FocoMapa } from '../components/ecopontos/geo';
import { useLocalizacaoUsuario } from '../hooks/useLocalizacaoUsuario';
import {
  buscarEcoponto,
  identificarEndereco,
  obterPermissao,
  removerEcoponto,
  salvarEcoponto,
  type Coordenada,
  type MaterialCodigo,
  type StatusPonto,
  type TipoPonto,
} from '../services/ecopontosService';

const ZOOM_PONTO = 17;

function lerCoordenada(texto: string, min: number, max: number) {
  const valor = Number(texto.trim().replace(',', '.'));
  return texto.trim() !== '' && Number.isFinite(valor) && valor >= min && valor <= max ? valor : null;
}

function Campo({ rotulo, obrigatorio, ...props }: TextInputProps & { rotulo: string; obrigatorio?: boolean }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>
        {rotulo}
        {obrigatorio && <Text style={styles.obrigatorio}> *</Text>}
      </Text>
      <TextInput placeholderTextColor={CORES.textoTerciario} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { valor: T; rotulo: string; cor?: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentado}>
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <Pressable
            key={opcao.valor}
            onPress={() => onChange(opcao.valor)}
            style={[styles.segmento, ativo && { backgroundColor: opcao.cor ?? CORES.primaria }]}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
          >
            <Text style={[styles.segmentoTexto, ativo && styles.segmentoTextoAtivo]}>{opcao.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function EcopontoCadastroScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= BREAKPOINT_DESKTOP;
  const params = useLocalSearchParams<{ id?: string }>();
  const idEdicao = params.id ? Number(params.id) : undefined;
  const { coordenada: usuario, solicitar: solicitarLocalizacao, status: statusLocalizacao } =
    useLocalizacaoUsuario();

  // Formulário
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoPonto>('ecoponto');
  const [status, setStatus] = useState<StatusPonto>('operando');
  const [materiais, setMateriais] = useState<MaterialCodigo[]>([]);
  const [latTexto, setLatTexto] = useState('');
  const [lngTexto, setLngTexto] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [descricao, setDescricao] = useState('');

  // Estado da tela
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [foco, setFoco] = useState<FocoMapa>(() => criarFoco(FOCO_BRASIL));
  // Rua/bairro/CEP preenchidos automaticamente podem ser sobrescritos ao mover o pino
  const enderecoAutomaticoRef = useRef(true);
  const consultaEnderecoRef = useRef(0);

  const posicao = useMemo<Coordenada | null>(() => {
    const latitude = lerCoordenada(latTexto, -90, 90);
    const longitude = lerCoordenada(lngTexto, -180, 180);
    return latitude !== null && longitude !== null ? { latitude, longitude } : null;
  }, [latTexto, lngTexto]);

  const voltar = useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/ecopontos')),
    [router],
  );

  // Permissão + dados do ponto (edição) ou localização atual (novo)
  useEffect(() => {
    let ativo = true;
    (async () => {
      const permissao = await obterPermissao();
      if (!ativo) return;
      if (!permissao) {
        setSemPermissao('Faça login para cadastrar pontos de coleta.');
        setCarregando(false);
        return;
      }

      if (idEdicao) {
        try {
          const ponto = await buscarEcoponto(idEdicao);
          if (!ativo) return;
          if (!permissao.admin && ponto.id_usuario_cadastro !== permissao.id_usuario) {
            setSemPermissao('Apenas quem cadastrou este ponto ou um administrador pode editá-lo.');
          } else {
            setNome(ponto.nome);
            setTipo(ponto.tipo);
            setStatus(ponto.status);
            setMateriais(ponto.materiais);
            setLatTexto(ponto.latitude.toFixed(6));
            setLngTexto(ponto.longitude.toFixed(6));
            setCidade(ponto.cidade);
            setEstado(ponto.estado);
            setLogradouro(ponto.logradouro ?? '');
            setBairro(ponto.bairro ?? '');
            setCep(ponto.cep ?? '');
            setDescricao(ponto.descricao ?? '');
            enderecoAutomaticoRef.current = false;
            setFoco(criarFoco({ latitude: ponto.latitude, longitude: ponto.longitude, zoom: ZOOM_PONTO }));
          }
        } catch (e) {
          if (ativo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar o ponto.');
        }
      } else if (!permissao.pode_cadastrar) {
        setSemPermissao(
          'Somente contas de administrador, cooperativa, empresa ou indústria podem cadastrar pontos de coleta.',
        );
      } else {
        const atual = await solicitarLocalizacao();
        if (ativo && atual) setFoco(criarFoco({ ...atual, zoom: 15 }));
      }
      if (ativo) setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [idEdicao, solicitarLocalizacao]);

  /** Define a posição exata e completa o endereço pela coordenada. */
  const definirPosicao = useCallback(async (coordenada: Coordenada) => {
    setLatTexto(coordenada.latitude.toFixed(6));
    setLngTexto(coordenada.longitude.toFixed(6));
    setErro(null);

    const consulta = ++consultaEnderecoRef.current;
    setBuscandoEndereco(true);
    try {
      const endereco = await identificarEndereco(coordenada);
      if (consulta !== consultaEnderecoRef.current) return;
      setCidade(endereco.nome);
      setEstado(endereco.estado);
      if (enderecoAutomaticoRef.current) {
        setLogradouro(endereco.logradouro ?? '');
        setBairro(endereco.bairro ?? '');
        setCep(endereco.cep ?? '');
      }
    } catch {
      // Sem endereço automático: o usuário pode preencher cidade/UF manualmente.
    } finally {
      if (consulta === consultaEnderecoRef.current) setBuscandoEndereco(false);
    }
  }, []);

  const usarMinhaLocalizacao = async () => {
    const atual = usuario ?? (await solicitarLocalizacao());
    if (!atual) {
      setErro('Não foi possível obter sua localização. Toque no mapa para marcar o ponto.');
      return;
    }
    setFoco(criarFoco({ ...atual, zoom: ZOOM_PONTO }));
    void definirPosicao(atual);
  };

  const aplicarCoordenadasDigitadas = () => {
    if (posicao) {
      setFoco(criarFoco({ ...posicao, zoom: ZOOM_PONTO }));
      void definirPosicao(posicao);
    }
  };

  const editarEndereco = (setter: (v: string) => void) => (valor: string) => {
    enderecoAutomaticoRef.current = false;
    setter(valor);
  };

  const salvar = async () => {
    setErro(null);
    if (nome.trim().length < 3) return setErro('Informe o nome do ponto (mínimo 3 caracteres).');
    if (!posicao) return setErro('Marque a localização exata no mapa ou digite latitude e longitude válidas.');
    if (materiais.length === 0) return setErro('Selecione ao menos um material aceito.');

    setSalvando(true);
    try {
      await salvarEcoponto(
        {
          nome: nome.trim(),
          tipo,
          status,
          materiais,
          latitude: posicao.latitude,
          longitude: posicao.longitude,
          cidade: cidade.trim() || null,
          estado: estado.trim().toUpperCase() || null,
          logradouro: logradouro.trim() || null,
          bairro: bairro.trim() || null,
          cep: cep.trim() || null,
          descricao: descricao.trim() || null,
        },
        idEdicao,
      );
      voltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o ponto.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!idEdicao) return;
    if (!confirmarRemocao) {
      setConfirmarRemocao(true);
      return;
    }
    setSalvando(true);
    try {
      await removerEcoponto(idEdicao);
      voltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível remover o ponto.');
      setSalvando(false);
    }
  };

  // ---------------------------------------------------------------------------

  const cabecalho = (
    <View style={styles.topBar}>
      <Pressable onPress={voltar} style={styles.botaoRedondo} accessibilityLabel="Voltar">
        <MaterialCommunityIcons name="arrow-left" size={24} color={CORES.primariaEscura} />
      </Pressable>
      <Text style={styles.topBarTitulo}>{idEdicao ? 'Editar ponto de coleta' : 'Novo ponto de coleta'}</Text>
      <View style={styles.botaoRedondoVazio} />
    </View>
  );

  if (carregando || semPermissao) {
    return (
      <SafeAreaView style={styles.container}>
        {cabecalho}
        <View style={styles.centro}>
          {carregando ? (
            <ActivityIndicator size="large" color={CORES.primaria} />
          ) : (
            <>
              <MaterialCommunityIcons name="lock-outline" size={40} color={CORES.textoTerciario} />
              <Text style={styles.centroTexto}>{semPermissao}</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const mapa = (
    <View style={[styles.mapa, !desktop && styles.mapaMobile]}>
      <EcopontoMap
        ecopontos={[]}
        foco={foco}
        localizacaoUsuario={usuario}
        onPressMapa={(c) => void definirPosicao(c)}
        marcadorEdicao={posicao}
        onMoverMarcadorEdicao={(c) => void definirPosicao(c)}
      />
      <View style={styles.dicaMapa} pointerEvents="none">
        <MaterialCommunityIcons name="gesture-tap" size={16} color={CORES.branco} />
        <Text style={styles.dicaMapaTexto}>
          {posicao ? 'Toque em outro lugar ou arraste o pino para ajustar' : 'Toque no mapa no local exato do ponto'}
        </Text>
      </View>
      <Pressable
        onPress={() => void usarMinhaLocalizacao()}
        style={styles.botaoLocalizar}
        accessibilityLabel="Usar minha localização"
      >
        {statusLocalizacao === 'carregando' ? (
          <ActivityIndicator size="small" color={CORES.primaria} />
        ) : (
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color={CORES.primaria} />
        )}
      </Pressable>
    </View>
  );

  const localizacao = (
    <View style={styles.secao}>
      <Text style={styles.tituloSecao}>Localização exata</Text>
      <View style={styles.busca}>
        <CidadeSearchBar onSelecionar={(c) => setFoco(criarFoco({ ...c, zoom: 13 }))} />
      </View>
      {!desktop && mapa}
      <View style={styles.linha}>
        <Campo
          rotulo="Latitude"
          obrigatorio
          value={latTexto}
          onChangeText={setLatTexto}
          onBlur={aplicarCoordenadasDigitadas}
          onSubmitEditing={aplicarCoordenadasDigitadas}
          placeholder="-10.184712"
          keyboardType="numbers-and-punctuation"
          style={styles.inputCoordenada}
        />
        <Campo
          rotulo="Longitude"
          obrigatorio
          value={lngTexto}
          onChangeText={setLngTexto}
          onBlur={aplicarCoordenadasDigitadas}
          onSubmitEditing={aplicarCoordenadasDigitadas}
          placeholder="-48.333612"
          keyboardType="numbers-and-punctuation"
          style={styles.inputCoordenada}
        />
      </View>
      <Text style={styles.ajuda}>
        Toque no mapa, arraste o pino ou cole as coordenadas (no Google Maps: clique com o botão direito no local e
        copie os números).
      </Text>
      {buscandoEndereco && (
        <View style={styles.linhaCarregando}>
          <ActivityIndicator size="small" color={CORES.primaria} />
          <Text style={styles.ajuda}>Buscando endereço...</Text>
        </View>
      )}
      <View style={styles.linha}>
        <View style={styles.flex2}>
          <Campo rotulo="Cidade" obrigatorio value={cidade} onChangeText={setCidade} placeholder="Palmas" />
        </View>
        <View style={styles.flex1}>
          <Campo
            rotulo="UF"
            obrigatorio
            value={estado}
            onChangeText={(v) => setEstado(v.toUpperCase().slice(0, 2))}
            placeholder="TO"
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>
      </View>
      <Campo
        rotulo="Logradouro"
        value={logradouro}
        onChangeText={editarEndereco(setLogradouro)}
        placeholder="Rua, avenida, quadra..."
      />
      <View style={styles.linha}>
        <View style={styles.flex2}>
          <Campo rotulo="Bairro" value={bairro} onChangeText={editarEndereco(setBairro)} />
        </View>
        <View style={styles.flex1}>
          <Campo
            rotulo="CEP"
            value={cep}
            onChangeText={editarEndereco(setCep)}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>
      </View>
    </View>
  );

  const formulario = (
    <>
      {erro && (
        <View style={styles.erro}>
          <MaterialCommunityIcons name="alert-circle-outline" size={18} color={CORES.erro} />
          <Text style={styles.erroTexto}>{erro}</Text>
        </View>
      )}

      <View style={styles.secao}>
        <Text style={styles.tituloSecao}>Identificação</Text>
        <Campo rotulo="Nome" obrigatorio value={nome} onChangeText={setNome} placeholder="Ex.: Ecoponto Taquaralto" />
        <Text style={styles.rotulo}>Tipo</Text>
        <Segmentado
          valor={tipo}
          onChange={setTipo}
          opcoes={(Object.keys(TIPOS) as TipoPonto[]).map((t) => ({ valor: t, rotulo: TIPOS[t].label, cor: TIPOS[t].cor }))}
        />
        <Text style={styles.rotulo}>Situação</Text>
        <Segmentado
          valor={status}
          onChange={setStatus}
          opcoes={(Object.keys(STATUS) as StatusPonto[]).map((s) => ({
            valor: s,
            rotulo: STATUS[s].label,
            cor: STATUS[s].cor,
          }))}
        />
        {status === 'inativo' && (
          <Text style={styles.ajuda}>Pontos inativos ficam salvos no banco, mas não aparecem no mapa.</Text>
        )}
      </View>

      <View style={styles.secao}>
        <Text style={styles.tituloSecao}>
          Materiais aceitos<Text style={styles.obrigatorio}> *</Text>
        </Text>
        <MaterialFilterChips selecionados={materiais} onChange={setMateriais} layout="wrap" />
      </View>

      {localizacao}

      <View style={styles.secao}>
        <Text style={styles.tituloSecao}>Informações adicionais</Text>
        <Campo
          rotulo="Observações"
          value={descricao}
          onChangeText={setDescricao}
          multiline
          style={styles.inputMultilinha}
        />
      </View>

      <Pressable
        onPress={() => void salvar()}
        disabled={salvando}
        style={({ pressed }) => [styles.botaoSalvar, (pressed || salvando) && { opacity: 0.8 }]}
      >
        {salvando ? (
          <ActivityIndicator size="small" color={CORES.branco} />
        ) : (
          <MaterialCommunityIcons name="content-save-outline" size={20} color={CORES.branco} />
        )}
        <Text style={styles.botaoSalvarTexto}>{idEdicao ? 'Salvar alterações' : 'Cadastrar ponto'}</Text>
      </Pressable>

      {idEdicao && (
        <Pressable onPress={() => void remover()} disabled={salvando} style={styles.botaoRemover}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color={CORES.erro} />
          <Text style={styles.botaoRemoverTexto}>
            {confirmarRemocao ? 'Toque de novo para excluir do banco' : 'Excluir ponto'}
          </Text>
        </Pressable>
      )}
    </>
  );

  if (desktop) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.linhaDesktop}>
          <View style={styles.painelLateral}>
            {cabecalho}
            <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
              {formulario}
            </ScrollView>
          </View>
          {mapa}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {cabecalho}
        <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          {formulario}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CORES.fundo },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  topBarTitulo: { fontSize: 18, fontWeight: 'bold', color: CORES.primariaEscura },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  centroTexto: { fontSize: 15, color: CORES.textoSecundario, textAlign: 'center', lineHeight: 22 },

  conteudo: { padding: 16, paddingBottom: 40, gap: 16 },
  secao: {
    backgroundColor: CORES.branco,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: CORES.fundoClaro,
  },
  tituloSecao: { fontSize: 16, fontWeight: '700', color: CORES.primariaEscura, marginBottom: 2 },
  busca: { zIndex: 20 },

  campo: { gap: 4 },
  rotulo: { fontSize: 13, fontWeight: '600', color: CORES.textoSecundario },
  obrigatorio: { color: CORES.erro },
  input: {
    backgroundColor: CORES.fundo,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: CORES.texto,
  },
  inputCoordenada: { minWidth: 120 },
  inputMultilinha: { minHeight: 72, textAlignVertical: 'top' },
  linha: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  flex1: { flex: 1, minWidth: 70 },
  flex2: { flex: 2, minWidth: 140 },
  ajuda: { fontSize: 12, color: CORES.textoSecundario, lineHeight: 17 },
  linhaCarregando: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  segmentado: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segmento: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CORES.fundoSuave,
  },
  segmentoTexto: { fontSize: 13, fontWeight: '600', color: CORES.textoSecundario },
  segmentoTextoAtivo: { color: CORES.branco },

  erro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 12,
  },
  erroTexto: { flex: 1, color: CORES.erro, fontSize: 14 },

  // Mapa
  mapa: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#E8EEE8' },
  mapaMobile: { flex: 0, height: 320, borderRadius: 12 },
  dicaMapa: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(27, 94, 32, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dicaMapaTexto: { flex: 1, color: CORES.branco, fontSize: 12, fontWeight: '600' },
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },

  // Desktop
  linhaDesktop: { flex: 1, flexDirection: 'row' },
  painelLateral: {
    width: 460,
    maxWidth: '50%',
    borderRightWidth: 1,
    borderRightColor: CORES.borda,
    zIndex: 2,
  },

  botaoSalvar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CORES.primaria,
    borderRadius: 12,
    paddingVertical: 14,
  },
  botaoSalvarTexto: { color: CORES.branco, fontSize: 16, fontWeight: '700' },
  botaoRemover: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 12,
  },
  botaoRemoverTexto: { color: CORES.erro, fontSize: 15, fontWeight: '700' },
});
