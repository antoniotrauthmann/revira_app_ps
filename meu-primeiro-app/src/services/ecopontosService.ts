import { API_BASE_URL } from '../config/api';
import { getSessionToken } from '../config/session';

/** Materiais reciclados aceitos: garrafa PET, vidro, papel e latinha. */
export type MaterialCodigo = 'pet' | 'vidro' | 'papel' | 'latinha';

export type TipoPonto = 'ecoponto' | 'maquina';
/** 'inativo' esconde o ponto do mapa (substitui a antiga coluna `ativo`). */
export type StatusPonto = 'operando' | 'manutencao' | 'lotado' | 'inativo';

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface Ecoponto extends Coordenada {
  id_ecoponto: number;
  nome: string;
  tipo: TipoPonto;
  descricao: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  cep: string | null;
  materiais: MaterialCodigo[];
  status: StatusPonto;
  id_usuario_cadastro: number | null;
  distancia_km: number | null;
}

/** Campos enviados para cadastrar/editar um ponto. */
export interface EcopontoEntrada extends Coordenada {
  nome: string;
  tipo: TipoPonto;
  status: StatusPonto;
  materiais: MaterialCodigo[];
  descricao?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

export interface PermissaoEcopontos {
  id_usuario: number;
  tipo_usuario: string | null;
  pode_cadastrar: boolean;
  admin: boolean;
}

export interface EnderecoDetalhado extends Cidade {
  logradouro?: string | null;
  bairro?: string | null;
  cep?: string | null;
}

export interface Cidade extends Coordenada {
  nome: string;
  estado: string;
}

export interface CidadeSugestao extends Cidade {
  total_ecopontos: number;
  origem: 'osm' | 'banco';
}

export interface FiltrosEcopontos {
  cidade?: string;
  estado?: string;
  /** Coordenada de referência para calcular a distância (e o raio, se informado). */
  referencia?: Coordenada | null;
  raioKm?: number;
  materiais?: MaterialCodigo[];
  tipo?: TipoPonto;
}

const BASE = `${API_BASE_URL}/ecopontos`;

async function requisicao<T>(url: string, init: RequestInit = {}): Promise<T> {
  const resposta = await fetch(url, init);
  if (!resposta.ok) {
    let mensagem = `Erro ${resposta.status} ao consultar o servidor.`;
    try {
      const corpo = await resposta.json();
      if (corpo?.mensagem) mensagem = corpo.mensagem;
    } catch {
      // resposta sem JSON
    }
    throw new Error(mensagem);
  }
  return resposta.json() as Promise<T>;
}

function getJson<T>(url: string, signal?: AbortSignal) {
  return requisicao<T>(url, { signal });
}

async function requisicaoAutenticada<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new Error('Sua sessão expirou. Faça login novamente.');
  return requisicao<T>(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export function listarEcopontos(filtros: FiltrosEcopontos = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (filtros.cidade) params.set('cidade', filtros.cidade);
  if (filtros.estado) params.set('estado', filtros.estado);
  if (filtros.referencia) {
    params.set('lat', String(filtros.referencia.latitude));
    params.set('lng', String(filtros.referencia.longitude));
  }
  if (filtros.raioKm) params.set('raio_km', String(filtros.raioKm));
  if (filtros.materiais?.length) params.set('materiais', filtros.materiais.join(','));
  if (filtros.tipo) params.set('tipo', filtros.tipo);
  const query = params.toString();
  return getJson<Ecoponto[]>(query ? `${BASE}?${query}` : BASE, signal);
}

export function buscarEcoponto(id: number, signal?: AbortSignal) {
  return getJson<Ecoponto>(`${BASE}/${id}`, signal);
}

export function listarCidadesComEcopontos(signal?: AbortSignal) {
  return getJson<CidadeSugestao[]>(`${BASE}/cidades`, signal);
}

export function buscarCidades(termo: string, signal?: AbortSignal) {
  return getJson<CidadeSugestao[]>(
    `${BASE}/geocodificacao/cidades?q=${encodeURIComponent(termo.trim())}`,
    signal,
  );
}

export function identificarCidade(coordenada: Coordenada, signal?: AbortSignal) {
  return getJson<Cidade>(
    `${BASE}/geocodificacao/reversa?lat=${coordenada.latitude}&lng=${coordenada.longitude}`,
    signal,
  );
}

/** Endereços já cadastrados pelo usuário (rota existente do app). */
export async function buscarCidadeDoEnderecoCadastrado(idUsuario: number) {
  const enderecos = await getJson<{ cidade: string; estado: string }[]>(
    `${API_BASE_URL}/endereco/usuario/${idUsuario}`,
  );
  return enderecos[0] ?? null;
}

/** Endereço completo (rua, bairro, CEP) de uma coordenada — usado no cadastro. */
export function identificarEndereco(coordenada: Coordenada, signal?: AbortSignal) {
  return getJson<EnderecoDetalhado>(
    `${BASE}/geocodificacao/reversa?lat=${coordenada.latitude}&lng=${coordenada.longitude}&detalhado=1`,
    signal,
  );
}

/** Retorna null quando não há sessão (usuário não logado). */
export async function obterPermissao(): Promise<PermissaoEcopontos | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await requisicaoAutenticada<PermissaoEcopontos>(`${BASE}/permissao`);
  } catch {
    return null;
  }
}

export function salvarEcoponto(dados: EcopontoEntrada, id?: number) {
  return requisicaoAutenticada<Ecoponto>(id ? `${BASE}/${id}` : BASE, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(dados),
  });
}

export function removerEcoponto(id: number) {
  return requisicaoAutenticada<{ mensagem: string }>(`${BASE}/${id}`, { method: 'DELETE' });
}
