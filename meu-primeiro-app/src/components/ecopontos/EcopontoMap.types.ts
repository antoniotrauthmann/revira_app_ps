import type { Coordenada, Ecoponto } from '../../services/ecopontosService';
import type { FocoMapa } from './geo';

/**
 * Contrato comum às duas implementações do mapa:
 *  - EcopontoMap.tsx      → iOS/Android (react-native-maps, funciona no Expo Go)
 *  - EcopontoMap.web.tsx  → Web/Desktop (Leaflet + OpenStreetMap)
 * O Metro escolhe o arquivo certo pela extensão da plataforma.
 */
export interface EcopontoMapProps {
  ecopontos: Ecoponto[];
  foco: FocoMapa;
  localizacaoUsuario?: Coordenada | null;
  selecionadoId?: number | null;
  onSelecionar?: (ecoponto: Ecoponto) => void;
  /** Toque/clique numa área vazia do mapa (usado para marcar a posição exata no cadastro). */
  onPressMapa?: (coordenada: Coordenada) => void;
  /** Pino arrastável do ponto em edição (laranja). */
  marcadorEdicao?: Coordenada | null;
  onMoverMarcadorEdicao?: (coordenada: Coordenada) => void;
}
