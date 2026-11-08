import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordenada } from '../services/ecopontosService';

export type StatusLocalizacao = 'carregando' | 'concedida' | 'negada' | 'indisponivel';

const TEMPO_LIMITE_MS = 12000;

function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo esgotado ao obter localização.')), ms);
    promessa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (erro) => {
        clearTimeout(timer);
        reject(erro);
      },
    );
  });
}

/**
 * Obtém a localização atual (iOS, Android e Web via expo-location).
 * `solicitar()` pode ser chamado de novo, ex.: botão "Minha localização".
 */
export function useLocalizacaoUsuario() {
  const [coordenada, setCoordenada] = useState<Coordenada | null>(null);
  const [status, setStatus] = useState<StatusLocalizacao>('carregando');
  const montado = useRef(true);

  const solicitar = useCallback(async (): Promise<Coordenada | null> => {
    setStatus('carregando');
    try {
      const permissao = await Location.requestForegroundPermissionsAsync();
      if (permissao.status !== 'granted') {
        if (montado.current) setStatus('negada');
        return null;
      }

      let posicao: Location.LocationObject | null = null;
      try {
        posicao = await comTempoLimite(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          TEMPO_LIMITE_MS,
        );
      } catch {
        // GPS lento/desligado: tenta a última posição conhecida
        posicao = await Location.getLastKnownPositionAsync().catch(() => null);
      }

      if (!posicao) {
        if (montado.current) setStatus('indisponivel');
        return null;
      }

      const atual = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
      if (montado.current) {
        setCoordenada(atual);
        setStatus('concedida');
      }
      return atual;
    } catch (erro) {
      console.warn('Não foi possível obter a localização:', erro);
      if (montado.current) setStatus('indisponivel');
      return null;
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  return { coordenada, status, solicitar };
}
