import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaterialCodigo } from '../../services/ecopontosService';
import { CORES, MATERIAIS } from './constantes';

interface Props {
  selecionados: MaterialCodigo[];
  onChange: (materiais: MaterialCodigo[]) => void;
  /** "scroll" = linha horizontal (mobile); "wrap" = quebra em várias linhas (painel desktop). */
  layout?: 'scroll' | 'wrap';
}

export default function MaterialFilterChips({ selecionados, onChange, layout = 'scroll' }: Props) {
  const alternar = (codigo: MaterialCodigo) => {
    onChange(
      selecionados.includes(codigo) ? selecionados.filter((m) => m !== codigo) : [...selecionados, codigo],
    );
  };

  const chips = (
    <>
      {MATERIAIS.map((material) => {
        const ativo = selecionados.includes(material.codigo);
        return (
          <Pressable
            key={material.codigo}
            onPress={() => alternar(material.codigo)}
            style={[styles.chip, ativo && styles.chipAtivo]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ativo }}
            accessibilityLabel={`Filtrar por ${material.label}`}
          >
            <MaterialCommunityIcons
              name={material.icone}
              size={16}
              color={ativo ? CORES.branco : CORES.primaria}
            />
            <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{material.label}</Text>
          </Pressable>
        );
      })}
      {selecionados.length > 0 && (
        <Pressable onPress={() => onChange([])} style={styles.limpar} accessibilityLabel="Limpar filtros">
          <Text style={styles.limparTexto}>Limpar</Text>
        </Pressable>
      )}
    </>
  );

  if (layout === 'wrap') {
    return <View style={styles.wrap}>{chips}</View>;
  }

  return (
    <ScrollView
      horizontal
      // Sem isto o ScrollView herda flexGrow: 1 e "estica" na vertical, disputando espaço com o mapa
      style={styles.scrollView}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flexGrow: 0, flexShrink: 0 },
  scroll: { gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.branco,
  },
  chipAtivo: { backgroundColor: CORES.primaria, borderColor: CORES.primaria },
  chipTexto: { fontSize: 13, fontWeight: '600', color: CORES.primaria },
  chipTextoAtivo: { color: CORES.branco },
  limpar: { justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  limparTexto: { fontSize: 13, fontWeight: '600', color: CORES.textoSecundario, textDecorationLine: 'underline' },
});
