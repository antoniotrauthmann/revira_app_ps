import type { Coordenada } from '../../services/ecopontosService';

/**
 * Para onde a câmera do mapa deve ir. Sempre que `id` muda, o mapa anima até
 * o novo ponto — assim a tela controla a câmera sem acoplar a uma biblioteca.
 * `zoom` segue a escala de tiles web (3 = país, 12 = cidade, 16 = rua).
 */
export interface FocoMapa extends Coordenada {
  zoom: number;
  id: number;
}

export const FOCO_BRASIL = { latitude: -14.235, longitude: -51.925, zoom: 4 };

let proximoIdFoco = 1;
export function criarFoco(alvo: Coordenada & { zoom: number }): FocoMapa {
  proximoIdFoco += 1;
  return { latitude: alvo.latitude, longitude: alvo.longitude, zoom: alvo.zoom, id: proximoIdFoco };
}

/** Centro e zoom que enquadram todos os pontos. */
export function enquadrarPontos(
  pontos: Coordenada[],
  padrao: Coordenada & { zoom: number },
): Coordenada & { zoom: number } {
  if (pontos.length === 0) return padrao;
  if (pontos.length === 1) return { ...pontos[0], zoom: 15 };

  let latMin = Infinity;
  let latMax = -Infinity;
  let lngMin = Infinity;
  let lngMax = -Infinity;
  for (const p of pontos) {
    latMin = Math.min(latMin, p.latitude);
    latMax = Math.max(latMax, p.latitude);
    lngMin = Math.min(lngMin, p.longitude);
    lngMax = Math.max(lngMax, p.longitude);
  }
  const span = Math.max(latMax - latMin, lngMax - lngMin, 0.005) * 1.5;
  const zoom = Math.min(16, Math.max(3, Math.floor(Math.log2(360 / span))));
  return { latitude: (latMin + latMax) / 2, longitude: (lngMin + lngMax) / 2, zoom };
}

/** Converte o zoom web para o delta usado pelo react-native-maps. */
export function zoomParaDelta(zoom: number) {
  return 360 / Math.pow(2, zoom);
}

export function formatarDistancia(km: number | null | undefined) {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

export function urlComoChegar(destino: Coordenada) {
  return `https://www.google.com/maps/dir/?api=1&destination=${destino.latitude},${destino.longitude}`;
}
