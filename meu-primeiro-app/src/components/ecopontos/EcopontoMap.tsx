// Implementação nativa (iOS / Android / Expo Go) usando react-native-maps.
// Na Web o Metro carrega EcopontoMap.web.tsx no lugar deste arquivo.
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { CORES, TIPOS } from './constantes';
import type { EcopontoMapProps } from './EcopontoMap.types';
import { zoomParaDelta, type FocoMapa } from './geo';

function focoParaRegiao(foco: FocoMapa): Region {
  const delta = zoomParaDelta(foco.zoom);
  return {
    latitude: foco.latitude,
    longitude: foco.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
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
  const mapRef = useRef<MapView>(null);
  const regiaoInicial = useRef(focoParaRegiao(foco)).current;

  useEffect(() => {
    mapRef.current?.animateToRegion(focoParaRegiao(foco), 600);
    // Só anima quando a tela pede um novo foco (id muda).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco.id]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={regiaoInicial}
      showsUserLocation={!!localizacaoUsuario}
      showsMyLocationButton={false}
      showsCompass
      toolbarEnabled={false}
      onPress={(evento) => {
        // No iOS o toque em um marcador também dispara onPress do mapa
        if (evento.nativeEvent.action === 'marker-press') return;
        onPressMapa?.(evento.nativeEvent.coordinate);
      }}
    >
      {ecopontos.map((ponto) => {
        const selecionado = ponto.id_ecoponto === selecionadoId;
        return (
          <Marker
            key={`${ponto.id_ecoponto}-${selecionado ? 's' : 'n'}`}
            coordinate={{ latitude: ponto.latitude, longitude: ponto.longitude }}
            title={ponto.nome}
            description={TIPOS[ponto.tipo].label}
            pinColor={selecionado ? CORES.selecionado : TIPOS[ponto.tipo].cor}
            zIndex={selecionado ? 10 : 1}
            onPress={() => onSelecionar?.(ponto)}
          />
        );
      })}
      {marcadorEdicao && (
        <Marker
          coordinate={marcadorEdicao}
          pinColor={CORES.selecionado}
          draggable
          zIndex={20}
          title="Local do ponto"
          description="Arraste para ajustar"
          onDragEnd={(evento) => onMoverMarcadorEdicao?.(evento.nativeEvent.coordinate)}
        />
      )}
    </MapView>
  );
}
