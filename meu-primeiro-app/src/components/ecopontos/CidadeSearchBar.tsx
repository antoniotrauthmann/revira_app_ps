import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { buscarCidades, type CidadeSugestao } from '../../services/ecopontosService';
import { CORES } from './constantes';

interface Props {
  onSelecionar: (cidade: CidadeSugestao) => void;
  /** Texto exibido quando uma cidade está ativa (ex.: "Palmas - TO"). */
  valorAtual?: string;
}

const ATRASO_BUSCA_MS = 400;

export default function CidadeSearchBar({ onSelecionar, valorAtual }: Props) {
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState(false);
  const [sugestoes, setSugestoes] = useState<CidadeSugestao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const termo = texto.trim();
    if (!editando || termo.length < 2) {
      setSugestoes([]);
      setBuscando(false);
      setErro(null);
      return;
    }

    const controle = new AbortController();
    setBuscando(true);
    const timer = setTimeout(() => {
      buscarCidades(termo, controle.signal)
        .then((lista) => {
          setSugestoes(lista);
          setErro(lista.length === 0 ? 'Nenhuma cidade encontrada.' : null);
        })
        .catch((e: Error) => {
          if (e.name !== 'AbortError') setErro('Não foi possível buscar cidades.');
        })
        .finally(() => !controle.signal.aborted && setBuscando(false));
    }, ATRASO_BUSCA_MS);

    return () => {
      clearTimeout(timer);
      controle.abort();
    };
  }, [texto, editando]);

  const selecionar = (cidade: CidadeSugestao) => {
    onSelecionar(cidade);
    setTexto('');
    setEditando(false);
    setSugestoes([]);
    inputRef.current?.blur();
    Keyboard.dismiss();
  };

  const mostrarLista = editando && texto.trim().length >= 2;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.campo, editando && styles.campoAtivo]}>
        <MaterialCommunityIcons name="magnify" size={20} color={CORES.textoSecundario} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={editando ? texto : texto || valorAtual || ''}
          onChangeText={setTexto}
          onFocus={() => setEditando(true)}
          // pequeno atraso para o toque na sugestão ser registrado antes de fechar
          onBlur={() => setTimeout(() => setEditando(false), 150)}
          placeholder="Pesquisar outra cidade..."
          placeholderTextColor={CORES.textoTerciario}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={() => sugestoes[0] && selecionar(sugestoes[0])}
          accessibilityLabel="Pesquisar cidade"
        />
        {buscando ? (
          <ActivityIndicator size="small" color={CORES.primaria} />
        ) : editando && texto.length > 0 ? (
          <Pressable onPress={() => setTexto('')} hitSlop={10} accessibilityLabel="Limpar busca">
            <MaterialCommunityIcons name="close-circle" size={18} color={CORES.textoTerciario} />
          </Pressable>
        ) : null}
      </View>

      {mostrarLista && (sugestoes.length > 0 || erro) && (
        <View style={styles.lista}>
          {sugestoes.map((cidade) => (
            <Pressable
              key={`${cidade.nome}-${cidade.estado}`}
              onPress={() => selecionar(cidade)}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressionado]}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={20} color={CORES.primaria} />
              <View style={styles.itemTexto}>
                <Text style={styles.itemNome}>
                  {cidade.nome} - {cidade.estado}
                </Text>
                <Text style={styles.itemDetalhe}>
                  {cidade.total_ecopontos > 0
                    ? `${cidade.total_ecopontos} ponto${cidade.total_ecopontos > 1 ? 's' : ''} de coleta`
                    : 'Sem pontos cadastrados'}
                </Text>
              </View>
            </Pressable>
          ))}
          {sugestoes.length === 0 && erro && <Text style={styles.vazio}>{erro}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 20 },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CORES.branco,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingHorizontal: 12,
    height: 46,
  },
  campoAtivo: { borderColor: CORES.primaria },
  input: {
    flex: 1,
    fontSize: 15,
    color: CORES.texto,
    height: '100%',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  lista: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: CORES.branco,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.borda,
    paddingVertical: 4,
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  itemPressionado: { backgroundColor: CORES.fundoSuave },
  itemTexto: { flex: 1 },
  itemNome: { fontSize: 15, fontWeight: '600', color: CORES.texto },
  itemDetalhe: { fontSize: 12, color: CORES.textoSecundario, marginTop: 2 },
  vazio: { padding: 12, fontSize: 14, color: CORES.textoSecundario },
});
