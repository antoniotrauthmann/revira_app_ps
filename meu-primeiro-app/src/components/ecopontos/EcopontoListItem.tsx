import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Ecoponto } from '../../services/ecopontosService';
import { CORES, MATERIAL_POR_CODIGO, STATUS, TIPOS } from './constantes';
import { formatarDistancia } from './geo';

interface Props {
  ecoponto: Ecoponto;
  selecionado?: boolean;
  onPress: (ecoponto: Ecoponto) => void;
}

function EcopontoListItem({ ecoponto, selecionado, onPress }: Props) {
  const tipo = TIPOS[ecoponto.tipo];
  const distancia = formatarDistancia(ecoponto.distancia_km);
  const endereco = [ecoponto.logradouro, ecoponto.bairro].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => onPress(ecoponto)}
      style={({ pressed }) => [styles.item, selecionado && styles.itemSelecionado, pressed && styles.itemPressionado]}
      accessibilityRole="button"
      accessibilityLabel={`${ecoponto.nome}, ${tipo.label}${distancia ? `, a ${distancia}` : ''}`}
    >
      <View style={[styles.icone, { backgroundColor: `${tipo.cor}1A` }]}>
        <MaterialCommunityIcons name={tipo.icone} size={20} color={tipo.cor} />
      </View>

      <View style={styles.info}>
        <View style={styles.linhaTitulo}>
          <Text style={styles.nome} numberOfLines={1}>
            {ecoponto.nome}
          </Text>
          {distancia && <Text style={styles.distancia}>{distancia}</Text>}
        </View>
        {!!endereco && (
          <Text style={styles.endereco} numberOfLines={1}>
            {endereco}
          </Text>
        )}
        <View style={styles.linhaMateriais}>
          {ecoponto.materiais.map((codigo) => (
            <MaterialCommunityIcons
              key={codigo}
              name={MATERIAL_POR_CODIGO[codigo].icone}
              size={14}
              color={CORES.textoSecundario}
              accessibilityLabel={MATERIAL_POR_CODIGO[codigo].label}
            />
          ))}
          {ecoponto.status !== 'operando' && (
            <View style={[styles.status, { backgroundColor: STATUS[ecoponto.status].cor }]}>
              <Text style={styles.statusTexto}>{STATUS[ecoponto.status].label}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(EcopontoListItem);

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemSelecionado: { backgroundColor: CORES.fundoSuave, borderColor: CORES.selecionado },
  itemPressionado: { backgroundColor: CORES.fundoClaro },
  icone: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nome: { flex: 1, fontSize: 15, fontWeight: '600', color: CORES.texto },
  distancia: { fontSize: 13, fontWeight: '600', color: CORES.primaria },
  endereco: { fontSize: 13, color: CORES.textoSecundario },
  linhaMateriais: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  status: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusTexto: { fontSize: 11, fontWeight: '700', color: CORES.branco },
});
