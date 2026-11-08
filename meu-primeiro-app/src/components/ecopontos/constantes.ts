import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MaterialCodigo, StatusPonto, TipoPonto } from '../../services/ecopontosService';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const CORES = {
  primaria: '#2E7D32',
  primariaEscura: '#1B5E20',
  fundo: '#F4F9F4',
  fundoClaro: '#E8F5E9',
  fundoSuave: '#F1F7EE',
  borda: '#E0EDE1',
  texto: '#1B241D',
  textoSecundario: '#666',
  textoTerciario: '#9AA69C',
  branco: '#FFF',
  selecionado: '#F57C00',
  maquina: '#1565C0',
  usuario: '#1E88E5',
  erro: '#D32F2F',
};

export const MATERIAIS: { codigo: MaterialCodigo; label: string; icone: IconName }[] = [
  { codigo: 'pet', label: 'Garrafa PET', icone: 'bottle-soda-outline' },
  { codigo: 'vidro', label: 'Vidro', icone: 'glass-fragile' },
  { codigo: 'papel', label: 'Papel', icone: 'file-document-outline' },
  { codigo: 'latinha', label: 'Latinha', icone: 'cup-outline' },
];

export const MATERIAL_POR_CODIGO = Object.fromEntries(MATERIAIS.map((m) => [m.codigo, m])) as Record<
  MaterialCodigo,
  (typeof MATERIAIS)[number]
>;

export const TIPOS: Record<TipoPonto, { label: string; icone: IconName; cor: string }> = {
  ecoponto: { label: 'Ecoponto', icone: 'recycle', cor: CORES.primaria },
  maquina: { label: 'Máquina de coleta', icone: 'robot-outline', cor: CORES.maquina },
};

export const STATUS: Record<StatusPonto, { label: string; cor: string }> = {
  operando: { label: 'Operando', cor: CORES.primaria },
  manutencao: { label: 'Em manutenção', cor: '#E65100' },
  lotado: { label: 'Lotado', cor: CORES.erro },
  inativo: { label: 'Inativo', cor: '#757575' },
};

/** Largura mínima (px) para usar o layout de desktop com painel lateral. */
export const BREAKPOINT_DESKTOP = 820;
