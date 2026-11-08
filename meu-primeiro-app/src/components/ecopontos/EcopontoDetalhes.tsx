import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Ecoponto } from '../../services/ecopontosService';
import { CORES, MATERIAL_POR_CODIGO, STATUS, TIPOS } from './constantes';
import { formatarDistancia, urlComoChegar } from './geo';

interface Props {
  ecoponto: Ecoponto;
  onFechar?: () => void;
  /** Exibe o botão "Editar" (somente para quem cadastrou o ponto ou admin). */
  onEditar?: () => void;
}

export default function EcopontoDetalhes({ ecoponto, onFechar, onEditar }: Props) {
  const tipo = TIPOS[ecoponto.tipo];
  const status = STATUS[ecoponto.status];
  const distancia = formatarDistancia(ecoponto.distancia_km);
  const endereco = [ecoponto.logradouro, ecoponto.bairro, `${ecoponto.cidade} - ${ecoponto.estado}`]
    .filter(Boolean)
    .join(', ');

  const abrirRota = () => {
    Linking.openURL(urlComoChegar(ecoponto)).catch((e) => console.error('Não foi possível abrir a rota:', e));
  };

  return (
    <View style={styles.card}>
      <View style={styles.cabecalho}>
        <View style={[styles.icone, { backgroundColor: `${tipo.cor}1A` }]}>
          <MaterialCommunityIcons name={tipo.icone} size={24} color={tipo.cor} />
        </View>
        <View style={styles.titulos}>
          <Text style={styles.nome}>{ecoponto.nome}</Text>
          <View style={styles.badges}>
            <Text style={[styles.tipo, { color: tipo.cor }]}>{tipo.label}</Text>
            <View style={[styles.statusPonto, { backgroundColor: status.cor }]} />
            <Text style={[styles.statusTexto, { color: status.cor }]}>{status.label}</Text>
          </View>
        </View>
        {onFechar && (
          <Pressable onPress={onFechar} hitSlop={10} style={styles.fechar} accessibilityLabel="Fechar detalhes">
            <MaterialCommunityIcons name="close" size={20} color={CORES.textoSecundario} />
          </Pressable>
        )}
      </View>

      <View style={styles.linha}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color={CORES.textoSecundario} />
        <Text style={styles.linhaTexto}>
          {endereco}
          {distancia ? `  ·  ${distancia}` : ''}
        </Text>
      </View>

      {!!ecoponto.descricao && <Text style={styles.descricao}>{ecoponto.descricao}</Text>}

      <Text style={styles.subtitulo}>Materiais aceitos</Text>
      <View style={styles.materiais}>
        {ecoponto.materiais.map((codigo) => (
          <View key={codigo} style={styles.material}>
            <MaterialCommunityIcons name={MATERIAL_POR_CODIGO[codigo].icone} size={14} color={CORES.primaria} />
            <Text style={styles.materialTexto}>{MATERIAL_POR_CODIGO[codigo].label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.acoes}>
        <Pressable
          onPress={abrirRota}
          style={({ pressed }) => [styles.botao, pressed && { opacity: 0.85 }]}
          accessibilityRole="link"
        >
          <MaterialCommunityIcons name="directions" size={20} color={CORES.branco} />
          <Text style={styles.botaoTexto}>Como chegar</Text>
        </Pressable>
        {onEditar && (
          <Pressable
            onPress={onEditar}
            style={({ pressed }) => [styles.botaoSecundario, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Editar ponto de coleta"
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color={CORES.primaria} />
            <Text style={styles.botaoSecundarioTexto}>Editar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CORES.branco,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: CORES.fundoClaro,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icone: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulos: { flex: 1, gap: 4 },
  nome: { fontSize: 17, fontWeight: '700', color: CORES.texto },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tipo: { fontSize: 13, fontWeight: '600' },
  statusPonto: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
  statusTexto: { fontSize: 13, fontWeight: '600' },
  fechar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CORES.fundoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  linhaTexto: { flex: 1, fontSize: 14, color: CORES.texto, lineHeight: 20 },
  descricao: { fontSize: 13, color: CORES.textoSecundario, fontStyle: 'italic' },
  subtitulo: { fontSize: 13, fontWeight: '600', color: CORES.textoSecundario, marginTop: 2 },
  materiais: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  material: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CORES.fundoSuave,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  materialTexto: { fontSize: 12, fontWeight: '600', color: CORES.primariaEscura },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 4 },
  botaoSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: CORES.fundoClaro,
  },
  botaoSecundarioTexto: { color: CORES.primaria, fontSize: 15, fontWeight: '700' },
  botao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CORES.primaria,
    borderRadius: 12,
    paddingVertical: 12,
  },
  botaoTexto: { color: CORES.branco, fontSize: 15, fontWeight: '700' },
});
