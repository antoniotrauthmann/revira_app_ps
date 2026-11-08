// Implementação Web/Desktop usando Leaflet + tiles do OpenStreetMap.
// O Leaflet é carregado sob demanda via CDN (sem dependência npm extra) e só
// dentro de useEffect, o que mantém a renderização estática do Expo Router
// (web.output = "static") funcionando no servidor.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CORES, TIPOS } from './constantes';
import type { EcopontoMapProps } from './EcopontoMap.types';

const LEAFLET_VERSAO = '1.9.4';
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSAO}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSAO}/dist/leaflet.js`;

// O projeto não instala @types/leaflet; tipamos o mínimo necessário como `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Leaflet = any;

let carregamentoLeaflet: Promise<Leaflet> | null = null;

function carregarLeaflet(): Promise<Leaflet> {
  const w = window as unknown as { L?: Leaflet };
  if (w.L) return Promise.resolve(w.L);
  if (carregamentoLeaflet) return carregamentoLeaflet;

  carregamentoLeaflet = new Promise<Leaflet>((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => (w.L ? resolve(w.L) : reject(new Error('Leaflet não inicializou.')));
    script.onerror = () => {
      carregamentoLeaflet = null;
      reject(new Error('Não foi possível carregar o Leaflet.'));
    };
    document.body.appendChild(script);
  });
  return carregamentoLeaflet;
}

function escaparHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function iconePino(L: Leaflet, cor: string, selecionado: boolean) {
  const tamanho = selecionado ? 34 : 26;
  return L.divIcon({
    className: '',
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho],
    tooltipAnchor: [0, -tamanho],
    html: `<div style="
      width:${tamanho}px;height:${tamanho}px;background:${cor};
      border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(0,0,0,.35);box-sizing:border-box;cursor:pointer;">
      </div>`,
  });
}

export default function EcopontoMap({
  ecopontos,
  foco,
  localizacaoUsuario,
  selecionadoId,
  onSelecionar,
  onPressMapa,
  marcadorEdicao,
  onMoverMarcadorEdicao,
}: EcopontoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<Leaflet>(null);
  const mapaRef = useRef<Leaflet>(null);
  const camadaPontosRef = useRef<Leaflet>(null);
  const marcadorUsuarioRef = useRef<Leaflet>(null);
  const marcadorEdicaoRef = useRef<Leaflet>(null);
  const onSelecionarRef = useRef(onSelecionar);
  const onPressMapaRef = useRef(onPressMapa);
  const onMoverRef = useRef(onMoverMarcadorEdicao);
  const focoInicialRef = useRef(foco);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    onSelecionarRef.current = onSelecionar;
    onPressMapaRef.current = onPressMapa;
    onMoverRef.current = onMoverMarcadorEdicao;
  }, [onSelecionar, onPressMapa, onMoverMarcadorEdicao]);

  // Cria o mapa uma única vez
  useEffect(() => {
    let cancelado = false;
    let observador: ResizeObserver | null = null;

    carregarLeaflet()
      .then((L) => {
        if (cancelado || !containerRef.current) return;
        const inicial = focoInicialRef.current;
        const mapa = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
          [inicial.latitude, inicial.longitude],
          inicial.zoom,
        );
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa);

        leafletRef.current = L;
        mapaRef.current = mapa;
        camadaPontosRef.current = L.layerGroup().addTo(mapa);
        mapa.on('click', (e: { latlng: { lat: number; lng: number } }) =>
          onPressMapaRef.current?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }),
        );

        // Mantém o mapa correto quando o layout muda (rotação, painel lateral, resize da janela)
        if (typeof ResizeObserver !== 'undefined') {
          observador = new ResizeObserver(() => mapa.invalidateSize());
          observador.observe(containerRef.current);
        }
        setPronto(true);
      })
      .catch((e: Error) => !cancelado && setErro(e.message));

    return () => {
      cancelado = true;
      observador?.disconnect();
      mapaRef.current?.remove();
      mapaRef.current = null;
      camadaPontosRef.current = null;
      marcadorUsuarioRef.current = null;
      marcadorEdicaoRef.current = null;
    };
  }, []);

  // Marcadores dos ecopontos
  useEffect(() => {
    const L = leafletRef.current;
    const camada = camadaPontosRef.current;
    if (!pronto || !L || !camada) return;

    camada.clearLayers();
    for (const ponto of ecopontos) {
      const selecionado = ponto.id_ecoponto === selecionadoId;
      const cor = selecionado ? CORES.selecionado : TIPOS[ponto.tipo].cor;
      L.marker([ponto.latitude, ponto.longitude], {
        icon: iconePino(L, cor, selecionado),
        zIndexOffset: selecionado ? 1000 : 0,
        keyboard: true,
        title: ponto.nome,
      })
        .bindTooltip(escaparHtml(ponto.nome), { direction: 'top' })
        .on('click', () => onSelecionarRef.current?.(ponto))
        .addTo(camada);
    }
  }, [pronto, ecopontos, selecionadoId]);

  // Posição do usuário
  useEffect(() => {
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    if (!pronto || !L || !mapa) return;

    marcadorUsuarioRef.current?.remove();
    marcadorUsuarioRef.current = null;
    if (localizacaoUsuario) {
      marcadorUsuarioRef.current = L.circleMarker([localizacaoUsuario.latitude, localizacaoUsuario.longitude], {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: CORES.usuario,
        fillOpacity: 1,
      })
        .bindTooltip('Você está aqui')
        .addTo(mapa);
    }
  }, [pronto, localizacaoUsuario]);

  // Pino arrastável do ponto em edição
  useEffect(() => {
    const L = leafletRef.current;
    const mapa = mapaRef.current;
    if (!pronto || !L || !mapa) return;

    if (!marcadorEdicao) {
      marcadorEdicaoRef.current?.remove();
      marcadorEdicaoRef.current = null;
      return;
    }
    const posicao = [marcadorEdicao.latitude, marcadorEdicao.longitude];
    if (marcadorEdicaoRef.current) {
      marcadorEdicaoRef.current.setLatLng(posicao);
      return;
    }
    marcadorEdicaoRef.current = L.marker(posicao, {
      icon: iconePino(L, CORES.selecionado, true),
      draggable: true,
      zIndexOffset: 2000,
      title: 'Local do ponto',
    })
      .bindTooltip('Arraste para ajustar', { direction: 'top' })
      .on('dragend', (e: { target: Leaflet }) => {
        const { lat, lng } = e.target.getLatLng();
        onMoverRef.current?.({ latitude: lat, longitude: lng });
      })
      .addTo(mapa);
  }, [pronto, marcadorEdicao]);

  // Câmera
  useEffect(() => {
    if (!pronto || !mapaRef.current) return;
    mapaRef.current.flyTo([foco.latitude, foco.longitude], foco.zoom, { duration: 0.6 });
    // Só anima quando a tela pede um novo foco (id muda).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, foco.id]);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* isolation: os z-index internos do Leaflet não sobrepõem a busca/menus da tela */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, isolation: 'isolate', background: '#E8EEE8' }} />
      {!pronto && (
        <View style={styles.overlay} pointerEvents="none">
          {erro ? (
            <Text style={styles.erro}>{erro} Verifique sua conexão com a internet.</Text>
          ) : (
            <ActivityIndicator size="large" color={CORES.primaria} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  erro: { color: CORES.erro, textAlign: 'center', fontSize: 14 },
});
