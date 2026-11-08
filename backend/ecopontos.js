/**
 * Módulo de Ecopontos (Mapa Interativo)
 * ------------------------------------
 * Rotas REST isoladas para o mapa de ecopontos e máquinas de coleta.
 * Todos os pontos vêm da tabela `ecoponto` do MySQL (XAMPP) — não há dados fixos no código.
 * Registrado no server.js com:
 *
 *   const { criarRotasEcopontos } = require('./ecopontos');
 *   app.use('/ecopontos', criarRotasEcopontos(db, { autenticarSessao }));
 *
 * Rotas públicas:
 *   GET    /ecopontos                                  Lista com filtros (cidade, estado, lat, lng, raio_km, materiais, tipo)
 *   GET    /ecopontos/cidades                          Cidades que possuem ecopontos cadastrados
 *   GET    /ecopontos/geocodificacao/cidades?q=        Busca de cidades (OpenStreetMap/Nominatim + banco)
 *   GET    /ecopontos/geocodificacao/reversa?lat=&lng= Descobre a cidade de uma coordenada
 *   GET    /ecopontos/:id                              Detalhes de um ponto
 *
 * Rotas autenticadas (Authorization: Bearer <token da sessão>):
 *   GET    /ecopontos/permissao                        Se o usuário logado pode cadastrar/editar pontos
 *   POST   /ecopontos                                  Cadastra um ponto (coordenada exata)
 *   PUT    /ecopontos/:id                              Edita (autor do cadastro ou admin)
 *   DELETE /ecopontos/:id                              Remove (autor do cadastro ou admin)
 *
 * Status: operando | manutencao | lotado | inativo (inativo não aparece no mapa).
 * Materiais: pet, vidro, papel, latinha.
 *
 * A tabela é criada automaticamente na primeira requisição (mesmo padrão de
 * `sessao_usuario` no server.js). A estrutura também está em banco/ecopontos.sql.
 */
const express = require('express');

// Materiais reciclados aceitos pelos pontos: garrafa PET, vidro, papel e latinha.
const MATERIAIS_VALIDOS = ['pet', 'vidro', 'papel', 'latinha'];
const TIPOS_VALIDOS = ['ecoponto', 'maquina'];
// 'inativo' substitui a antiga coluna `ativo`: pontos inativos não aparecem no mapa.
const STATUS_VALIDOS = ['operando', 'manutencao', 'lotado', 'inativo'];
const SQL_STATUS_VISIVEL = "status <> 'inativo'";
const sqlListaEnum = (valores) => valores.map((v) => `'${v}'`).join(',');
// Tipos de conta (tabela usuario.tipo) que podem cadastrar pontos de coleta.
const TIPOS_USUARIO_GESTORES = ['admin', 'cooperativa', 'empresa', 'industria'];

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
// A política de uso do Nominatim exige um User-Agent que identifique a aplicação.
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT || 'ReviraApp/1.0 (projeto academico - marketplace de reciclaveis)';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ITENS = 500;
const RAIO_PADRAO_KM = 50;
const RAIO_MAXIMO_KM = 500;
const LIMITE_RESULTADOS = 500;

const SQL_CRIAR_TABELA = `
  CREATE TABLE IF NOT EXISTS ecoponto (
    id_ecoponto int(11) NOT NULL AUTO_INCREMENT,
    nome varchar(150) NOT NULL,
    tipo enum('ecoponto','maquina') NOT NULL DEFAULT 'ecoponto',
    descricao varchar(255) DEFAULT NULL,
    logradouro varchar(200) DEFAULT NULL,
    bairro varchar(100) DEFAULT NULL,
    cidade varchar(100) NOT NULL,
    estado char(2) NOT NULL,
    cep varchar(10) DEFAULT NULL,
    latitude decimal(9,6) NOT NULL,
    longitude decimal(9,6) NOT NULL,
    materiais set(${sqlListaEnum(MATERIAIS_VALIDOS)}) NOT NULL DEFAULT '',
    status enum(${sqlListaEnum(STATUS_VALIDOS)}) NOT NULL DEFAULT 'operando',
    id_usuario_cadastro int(11) DEFAULT NULL,
    criado_em timestamp NOT NULL DEFAULT current_timestamp(),
    atualizado_em timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
    PRIMARY KEY (id_ecoponto),
    KEY idx_ecoponto_cidade (cidade, estado),
    KEY idx_ecoponto_coordenadas (latitude, longitude),
    KEY idx_ecoponto_usuario (id_usuario_cadastro)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

const SQL_COLUNAS_EXISTENTES = `
  SELECT COLUMN_NAME AS nome, COLUMN_TYPE AS tipo
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ecoponto'
`;

// A versão anterior inseria 15 pontos fictícios automaticamente. Eles são
// removidos aqui (identificados pela descrição que só eles usavam e por não
// terem autor), para que o mapa mostre apenas pontos reais cadastrados.
const SQL_REMOVER_PONTOS_DEMONSTRACAO = `
  DELETE FROM ecoponto
  WHERE id_usuario_cadastro IS NULL
    AND descricao IN ('Dados de demonstração', 'Máquina de coleta (demonstração)')
`;

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function numeroOuNull(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function coordenadaValida(lat, lng) {
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function textoOpcional(valor, max) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto ? texto.slice(0, max) : null;
}

function parseMateriais(valor) {
  if (!valor) return [];
  const lista = Array.isArray(valor) ? valor : String(valor).split(',');
  return [...new Set(lista.map((m) => String(m).trim().toLowerCase()).filter((m) => MATERIAIS_VALIDOS.includes(m)))];
}

function formatarEcoponto(row) {
  return {
    id_ecoponto: row.id_ecoponto,
    nome: row.nome,
    tipo: row.tipo,
    descricao: row.descricao,
    logradouro: row.logradouro,
    bairro: row.bairro,
    cidade: row.cidade,
    estado: row.estado,
    cep: row.cep,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    materiais: parseMateriais(row.materiais),
    status: row.status,
    id_usuario_cadastro: row.id_usuario_cadastro ?? null,
    distancia_km:
      row.distancia_km === undefined || row.distancia_km === null
        ? null
        : Math.round(Number(row.distancia_km) * 100) / 100,
  };
}

// Distância (km) pela fórmula de Haversine, em SQL. Parâmetros: lat, lng, lat.
const SQL_DISTANCIA = `
  (6371 * ACOS(LEAST(1, GREATEST(-1,
    COS(RADIANS(?)) * COS(RADIANS(latitude)) * COS(RADIANS(longitude) - RADIANS(?)) +
    SIN(RADIANS(?)) * SIN(RADIANS(latitude))
  ))))
`;

// ---------------------------------------------------------------------------
// Cliente Nominatim (OpenStreetMap) com cache e limite de 1 requisição/segundo
// ---------------------------------------------------------------------------

const cache = new Map();
let filaNominatim = Promise.resolve();
let ultimaChamadaNominatim = 0;

function lerCache(chave) {
  const item = cache.get(chave);
  if (!item) return undefined;
  if (item.expira < Date.now()) {
    cache.delete(chave);
    return undefined;
  }
  return item.valor;
}

function gravarCache(chave, valor) {
  if (cache.size >= CACHE_MAX_ITENS) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(chave, { valor, expira: Date.now() + CACHE_TTL_MS });
}

function chamarNominatim(caminho, parametros) {
  const url = `${NOMINATIM_URL}${caminho}?${new URLSearchParams(parametros).toString()}`;
  const emCache = lerCache(url);
  if (emCache !== undefined) return Promise.resolve(emCache);

  const execucao = filaNominatim.then(async () => {
    const espera = 1100 - (Date.now() - ultimaChamadaNominatim);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaChamadaNominatim = Date.now();

    const resposta = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept-Language': 'pt-BR' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) throw new Error(`Nominatim respondeu ${resposta.status}`);
    const dados = await resposta.json();
    gravarCache(url, dados);
    return dados;
  });

  // Mantém a fila andando mesmo se esta chamada falhar.
  filaNominatim = execucao.catch(() => undefined);
  return execucao;
}

function extrairCidade(endereco = {}) {
  return endereco.city || endereco.town || endereco.village || endereco.municipality || endereco.city_district || null;
}

function extrairUf(endereco = {}) {
  const iso = endereco['ISO3166-2-lvl4'] || endereco['ISO3166-2-lvl3'] || '';
  const match = /^BR-([A-Z]{2})$/.exec(iso);
  return match ? match[1] : null;
}

/** Endereço (cidade, UF, rua, bairro, CEP) de uma coordenada via OpenStreetMap. */
async function geocodificarReverso(lat, lng, zoom = 18) {
  const dados = await chamarNominatim('/reverse', {
    lat: lat.toFixed(6),
    lon: lng.toFixed(6),
    zoom: String(zoom),
    format: 'jsonv2',
    addressdetails: '1',
  });
  const endereco = (dados && dados.address) || {};
  return {
    cidade: extrairCidade(endereco),
    estado: extrairUf(endereco),
    logradouro: endereco.road || endereco.pedestrian || endereco.square || null,
    bairro: endereco.suburb || endereco.neighbourhood || endereco.quarter || null,
    cep: endereco.postcode || null,
  };
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

function criarRotasEcopontos(db, opcoes = {}) {
  const router = express.Router();
  const consultar = (sql, params = []) => db.promise().query(sql, params).then(([rows]) => rows);
  const autenticar =
    opcoes.autenticarSessao ||
    ((_req, res) => res.status(503).json({ mensagem: 'Autenticação não configurada para ecopontos.' }));

  let schemaPronto = null;
  function garantirSchema() {
    if (!schemaPronto) {
      schemaPronto = (async () => {
        await consultar(SQL_CRIAR_TABELA);
        await migrarTabelaAntiga();
        const resultado = await consultar(SQL_REMOVER_PONTOS_DEMONSTRACAO);
        if (resultado.affectedRows > 0) {
          console.log(`Ecopontos: ${resultado.affectedRows} ponto(s) de demonstração removido(s).`);
        }
      })().catch((erro) => {
        schemaPronto = null;
        throw erro;
      });
    }
    return schemaPronto;
  }

  /**
   * Atualiza tabelas criadas pelas versões anteriores deste módulo:
   * - adiciona id_usuario_cadastro / atualizado_em;
   * - troca a coluna `ativo` pelo status 'inativo';
   * - remove horario_funcionamento e telefone;
   * - reduz os materiais a pet, vidro, papel e latinha.
   */
  async function migrarTabelaAntiga() {
    const colunas = await consultar(SQL_COLUNAS_EXISTENTES);
    const tipoColuna = Object.fromEntries(colunas.map((c) => [c.nome, String(c.tipo).toLowerCase()]));

    if (!tipoColuna.id_usuario_cadastro) {
      await consultar('ALTER TABLE ecoponto ADD COLUMN id_usuario_cadastro int(11) DEFAULT NULL');
    }
    if (!tipoColuna.atualizado_em) {
      await consultar(
        'ALTER TABLE ecoponto ADD COLUMN atualizado_em timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()',
      );
    }

    const statusEsperado = `enum(${sqlListaEnum(STATUS_VALIDOS)})`;
    if (tipoColuna.status !== statusEsperado) {
      await consultar(`ALTER TABLE ecoponto MODIFY status ${statusEsperado} NOT NULL DEFAULT 'operando'`);
    }
    if (tipoColuna.ativo) {
      await consultar("UPDATE ecoponto SET status = 'inativo' WHERE ativo = 0");
      await consultar('ALTER TABLE ecoponto DROP COLUMN ativo');
    }
    for (const coluna of ['horario_funcionamento', 'telefone']) {
      if (tipoColuna[coluna]) await consultar(`ALTER TABLE ecoponto DROP COLUMN ${coluna}`);
    }

    const materiaisEsperado = `set(${sqlListaEnum(MATERIAIS_VALIDOS)})`;
    if (tipoColuna.materiais !== materiaisEsperado) {
      // Mantém apenas os materiais que continuam válidos antes de alterar o SET
      const manter = MATERIAIS_VALIDOS.map((m) => `IF(FIND_IN_SET('${m}', materiais) > 0, '${m}', NULL)`).join(', ');
      await consultar(`UPDATE ecoponto SET materiais = CONCAT_WS(',', ${manter})`);
      await consultar(`ALTER TABLE ecoponto MODIFY materiais ${materiaisEsperado} NOT NULL DEFAULT ''`);
    }
  }

  router.use(async (_req, res, next) => {
    try {
      await garantirSchema();
      next();
    } catch (erro) {
      console.error('Erro ao preparar a tabela de ecopontos:', erro);
      res.status(503).json({ mensagem: 'O serviço de ecopontos não está disponível no momento.' });
    }
  });

  async function buscarUsuario(idUsuario) {
    const [usuario] = await consultar('SELECT id_usuario, tipo FROM usuario WHERE id_usuario = ?', [idUsuario]);
    return usuario || null;
  }

  async function contarPorCidade(cidades) {
    if (cidades.length === 0) return new Map();
    const condicoes = cidades.map(() => '(cidade = ? AND estado = ?)').join(' OR ');
    const params = cidades.flatMap((c) => [c.nome, c.estado]);
    const rows = await consultar(
      `SELECT cidade, estado, COUNT(*) AS total FROM ecoponto WHERE ${SQL_STATUS_VISIVEL} AND (${condicoes}) GROUP BY cidade, estado`,
      params,
    );
    return new Map(rows.map((r) => [`${normalizarTexto(r.cidade)}|${r.estado}`, Number(r.total)]));
  }

  /**
   * Valida o corpo de POST/PUT. Completa cidade/UF pela coordenada quando
   * não forem enviados. Retorna { dados } ou { erro }.
   */
  async function validarCorpo(corpo = {}) {
    const nome = textoOpcional(corpo.nome, 150);
    if (!nome || nome.length < 3) return { erro: 'Informe o nome do ponto (mínimo 3 caracteres).' };

    const tipo = TIPOS_VALIDOS.includes(corpo.tipo) ? corpo.tipo : null;
    if (!tipo) return { erro: 'Tipo inválido. Use "ecoponto" ou "maquina".' };

    const status = corpo.status === undefined ? 'operando' : corpo.status;
    if (!STATUS_VALIDOS.includes(status)) return { erro: 'Status inválido.' };

    const latitude = numeroOuNull(corpo.latitude);
    const longitude = numeroOuNull(corpo.longitude);
    if (!coordenadaValida(latitude, longitude)) {
      return { erro: 'Marque a localização exata no mapa (latitude e longitude válidas).' };
    }

    const materiais = parseMateriais(corpo.materiais);
    if (materiais.length === 0) return { erro: 'Selecione ao menos um material aceito.' };

    let cidade = textoOpcional(corpo.cidade, 100);
    let estado = textoOpcional(corpo.estado, 2);
    let logradouro = textoOpcional(corpo.logradouro, 200);
    let bairro = textoOpcional(corpo.bairro, 100);
    let cep = textoOpcional(corpo.cep, 10);

    if (!cidade || !estado) {
      try {
        const endereco = await geocodificarReverso(latitude, longitude);
        cidade = cidade || endereco.cidade;
        estado = estado || endereco.estado;
        logradouro = logradouro || endereco.logradouro;
        bairro = bairro || endereco.bairro;
        cep = cep || (endereco.cep ? endereco.cep.slice(0, 10) : null);
      } catch (erroOsm) {
        console.warn('Não foi possível completar o endereço pelo OpenStreetMap:', erroOsm.message);
      }
    }
    if (!cidade || !estado || !/^[A-Za-z]{2}$/.test(estado)) {
      return { erro: 'Informe a cidade e a UF (2 letras) do ponto.' };
    }

    return {
      dados: {
        nome,
        tipo,
        status,
        descricao: textoOpcional(corpo.descricao, 255),
        logradouro,
        bairro,
        cidade,
        estado: estado.toUpperCase(),
        cep,
        latitude: Math.round(latitude * 1e6) / 1e6,
        longitude: Math.round(longitude * 1e6) / 1e6,
        materiais: materiais.join(','),
      },
    };
  }

  // Carrega o ponto e verifica se o usuário logado pode alterá-lo.
  async function carregarParaAlterar(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ mensagem: 'Identificador inválido.' });
      return null;
    }
    const [ponto] = await consultar('SELECT * FROM ecoponto WHERE id_ecoponto = ?', [id]);
    if (!ponto) {
      res.status(404).json({ mensagem: 'Ecoponto não encontrado.' });
      return null;
    }
    const usuario = await buscarUsuario(req.sessao.id_usuario);
    const ehAdmin = usuario && usuario.tipo === 'admin';
    if (!ehAdmin && ponto.id_usuario_cadastro !== req.sessao.id_usuario) {
      res.status(403).json({ mensagem: 'Apenas quem cadastrou o ponto ou um administrador pode alterá-lo.' });
      return null;
    }
    return ponto;
  }

  // GET /ecopontos
  router.get('/', async (req, res) => {
    try {
      const lat = numeroOuNull(req.query.lat);
      const lng = numeroOuNull(req.query.lng);
      const temCoordenada = coordenadaValida(lat, lng);
      const raio = numeroOuNull(req.query.raio_km);
      const cidade = typeof req.query.cidade === 'string' ? req.query.cidade.trim() : '';
      const estado = typeof req.query.estado === 'string' ? req.query.estado.trim().toUpperCase() : '';
      const materiais = parseMateriais(req.query.materiais);
      const tipo = TIPOS_VALIDOS.includes(req.query.tipo) ? req.query.tipo : null;

      const colunas = ['*'];
      const paramsColunas = [];
      if (temCoordenada) {
        colunas.push(`${SQL_DISTANCIA} AS distancia_km`);
        paramsColunas.push(lat, lng, lat);
      }

      const where = [SQL_STATUS_VISIVEL];
      const paramsWhere = [];
      if (cidade) {
        where.push('cidade = ?');
        paramsWhere.push(cidade);
      }
      if (estado) {
        where.push('estado = ?');
        paramsWhere.push(estado);
      }
      if (tipo) {
        where.push('tipo = ?');
        paramsWhere.push(tipo);
      }
      // O ponto precisa aceitar TODOS os materiais selecionados.
      materiais.forEach((m) => {
        where.push('FIND_IN_SET(?, materiais) > 0');
        paramsWhere.push(m);
      });

      let having = '';
      const paramsHaving = [];
      if (temCoordenada && (raio !== null || !cidade)) {
        const raioKm = Math.min(Math.max(raio ?? RAIO_PADRAO_KM, 1), RAIO_MAXIMO_KM);
        // Pré-filtro por caixa delimitadora (usa o índice) antes do cálculo exato.
        const dLat = raioKm / 111;
        const dLng = raioKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
        where.push('latitude BETWEEN ? AND ?', 'longitude BETWEEN ? AND ?');
        paramsWhere.push(lat - dLat, lat + dLat, lng - dLng, lng + dLng);
        having = 'HAVING distancia_km <= ?';
        paramsHaving.push(raioKm);
      }

      const ordem = temCoordenada ? 'distancia_km ASC' : 'nome ASC';
      const sql = `
        SELECT ${colunas.join(', ')}
        FROM ecoponto
        WHERE ${where.join(' AND ')}
        ${having}
        ORDER BY ${ordem}
        LIMIT ${LIMITE_RESULTADOS}
      `;
      const rows = await consultar(sql, [...paramsColunas, ...paramsWhere, ...paramsHaving]);
      res.json(rows.map(formatarEcoponto));
    } catch (erro) {
      console.error('Erro ao listar ecopontos:', erro);
      res.status(500).json({ mensagem: 'Erro ao buscar ecopontos.' });
    }
  });

  // GET /ecopontos/cidades
  router.get('/cidades', async (_req, res) => {
    try {
      const rows = await consultar(`
        SELECT cidade, estado, COUNT(*) AS total, AVG(latitude) AS latitude, AVG(longitude) AS longitude
        FROM ecoponto
        WHERE ${SQL_STATUS_VISIVEL}
        GROUP BY cidade, estado
        ORDER BY total DESC, cidade ASC
      `);
      res.json(
        rows.map((r) => ({
          nome: r.cidade,
          estado: r.estado,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          total_ecopontos: Number(r.total),
          origem: 'banco',
        })),
      );
    } catch (erro) {
      console.error('Erro ao listar cidades com ecopontos:', erro);
      res.status(500).json({ mensagem: 'Erro ao buscar cidades.' });
    }
  });

  // GET /ecopontos/permissao (autenticada)
  router.get('/permissao', autenticar, async (req, res) => {
    try {
      const usuario = await buscarUsuario(req.sessao.id_usuario);
      res.json({
        id_usuario: req.sessao.id_usuario,
        tipo_usuario: usuario ? usuario.tipo : null,
        pode_cadastrar: !!usuario && TIPOS_USUARIO_GESTORES.includes(usuario.tipo),
        admin: !!usuario && usuario.tipo === 'admin',
      });
    } catch (erro) {
      console.error('Erro ao verificar permissão de ecopontos:', erro);
      res.status(500).json({ mensagem: 'Erro ao verificar permissão.' });
    }
  });

  // GET /ecopontos/geocodificacao/cidades?q=palmas
  router.get('/geocodificacao/cidades', async (req, res) => {
    const termo = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (termo.length < 2) return res.json([]);

    const resultados = new Map();
    try {
      // 1) Cidades já cadastradas no banco (resposta imediata e funciona offline)
      const doBanco = await consultar(
        `SELECT cidade, estado, COUNT(*) AS total, AVG(latitude) AS latitude, AVG(longitude) AS longitude
         FROM ecoponto WHERE ${SQL_STATUS_VISIVEL} AND cidade LIKE ?
         GROUP BY cidade, estado ORDER BY total DESC LIMIT 5`,
        [`%${termo}%`],
      );

      // 2) OpenStreetMap (qualquer cidade do Brasil)
      let doOsm = [];
      try {
        doOsm = await chamarNominatim('/search', {
          q: termo,
          countrycodes: 'br',
          featureType: 'settlement',
          format: 'jsonv2',
          addressdetails: '1',
          limit: '8',
        });
      } catch (erroOsm) {
        console.warn('Busca de cidades no OpenStreetMap indisponível:', erroOsm.message);
      }

      for (const item of Array.isArray(doOsm) ? doOsm : []) {
        const nome = extrairCidade(item.address) || item.name;
        const estado = extrairUf(item.address);
        if (!nome || !estado) continue;
        const chave = `${normalizarTexto(nome)}|${estado}`;
        if (resultados.has(chave)) continue;
        resultados.set(chave, {
          nome,
          estado,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          total_ecopontos: 0,
          origem: 'osm',
        });
      }

      const contagens = await contarPorCidade([...resultados.values()]);
      for (const [chave, cidade] of resultados) {
        cidade.total_ecopontos = contagens.get(chave) || 0;
      }

      for (const r of doBanco) {
        const chave = `${normalizarTexto(r.cidade)}|${r.estado}`;
        if (resultados.has(chave)) continue;
        resultados.set(chave, {
          nome: r.cidade,
          estado: r.estado,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          total_ecopontos: Number(r.total),
          origem: 'banco',
        });
      }

      res.json([...resultados.values()].slice(0, 8));
    } catch (erro) {
      console.error('Erro ao buscar cidades:', erro);
      res.status(500).json({ mensagem: 'Erro ao buscar cidades.' });
    }
  });

  // GET /ecopontos/geocodificacao/reversa?lat=-10.18&lng=-48.33[&detalhado=1]
  router.get('/geocodificacao/reversa', async (req, res) => {
    const lat = numeroOuNull(req.query.lat);
    const lng = numeroOuNull(req.query.lng);
    if (!coordenadaValida(lat, lng)) {
      return res.status(400).json({ mensagem: 'Latitude e longitude inválidas.' });
    }
    const detalhado = req.query.detalhado === '1';

    try {
      const endereco = await geocodificarReverso(lat, lng, detalhado ? 18 : 10);
      if (endereco.cidade && endereco.estado) {
        return res.json({
          nome: endereco.cidade,
          estado: endereco.estado,
          latitude: lat,
          longitude: lng,
          origem: 'osm',
          ...(detalhado ? { logradouro: endereco.logradouro, bairro: endereco.bairro, cep: endereco.cep } : {}),
        });
      }
    } catch (erroOsm) {
      console.warn('Geocodificação reversa no OpenStreetMap indisponível:', erroOsm.message);
    }

    // Plano B: cidade do ecoponto cadastrado mais próximo (até 40 km)
    try {
      const [maisProximo] = await consultar(
        `SELECT cidade, estado, ${SQL_DISTANCIA} AS distancia_km
         FROM ecoponto WHERE ${SQL_STATUS_VISIVEL}
         HAVING distancia_km <= 40
         ORDER BY distancia_km ASC LIMIT 1`,
        [lat, lng, lat],
      );
      if (maisProximo) {
        return res.json({
          nome: maisProximo.cidade,
          estado: maisProximo.estado,
          latitude: lat,
          longitude: lng,
          origem: 'banco',
        });
      }
      res.status(404).json({ mensagem: 'Não foi possível identificar a cidade.' });
    } catch (erro) {
      console.error('Erro na geocodificação reversa:', erro);
      res.status(500).json({ mensagem: 'Erro ao identificar a cidade.' });
    }
  });

  // GET /ecopontos/:id
  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ mensagem: 'Identificador inválido.' });
    }
    try {
      // Retorna também pontos inativos, para que possam ser reativados na edição.
      const [row] = await consultar('SELECT * FROM ecoponto WHERE id_ecoponto = ?', [id]);
      if (!row) return res.status(404).json({ mensagem: 'Ecoponto não encontrado.' });
      res.json(formatarEcoponto(row));
    } catch (erro) {
      console.error('Erro ao buscar ecoponto:', erro);
      res.status(500).json({ mensagem: 'Erro ao buscar ecoponto.' });
    }
  });

  // POST /ecopontos (autenticada)
  router.post('/', autenticar, async (req, res) => {
    try {
      const usuario = await buscarUsuario(req.sessao.id_usuario);
      if (!usuario || !TIPOS_USUARIO_GESTORES.includes(usuario.tipo)) {
        return res.status(403).json({ mensagem: 'Sua conta não tem permissão para cadastrar pontos de coleta.' });
      }
      const { dados, erro } = await validarCorpo(req.body);
      if (erro) return res.status(400).json({ mensagem: erro });

      const resultado = await consultar('INSERT INTO ecoponto SET ?', [
        { ...dados, id_usuario_cadastro: req.sessao.id_usuario },
      ]);
      const [criado] = await consultar('SELECT * FROM ecoponto WHERE id_ecoponto = ?', [resultado.insertId]);
      res.status(201).json(formatarEcoponto(criado));
    } catch (erro) {
      console.error('Erro ao cadastrar ecoponto:', erro);
      res.status(500).json({ mensagem: 'Erro ao cadastrar o ponto de coleta.' });
    }
  });

  // PUT /ecopontos/:id (autenticada)
  router.put('/:id', autenticar, async (req, res) => {
    try {
      const ponto = await carregarParaAlterar(req, res);
      if (!ponto) return;
      const { dados, erro } = await validarCorpo(req.body);
      if (erro) return res.status(400).json({ mensagem: erro });

      await consultar('UPDATE ecoponto SET ? WHERE id_ecoponto = ?', [dados, ponto.id_ecoponto]);
      const [atualizado] = await consultar('SELECT * FROM ecoponto WHERE id_ecoponto = ?', [ponto.id_ecoponto]);
      res.json(formatarEcoponto(atualizado));
    } catch (erro) {
      console.error('Erro ao atualizar ecoponto:', erro);
      res.status(500).json({ mensagem: 'Erro ao atualizar o ponto de coleta.' });
    }
  });

  // DELETE /ecopontos/:id (autenticada) — remove o registro do banco.
  // Para apenas esconder do mapa, edite o ponto com status 'inativo'.
  router.delete('/:id', autenticar, async (req, res) => {
    try {
      const ponto = await carregarParaAlterar(req, res);
      if (!ponto) return;
      await consultar('DELETE FROM ecoponto WHERE id_ecoponto = ?', [ponto.id_ecoponto]);
      res.json({ mensagem: 'Ponto de coleta removido.' });
    } catch (erro) {
      console.error('Erro ao remover ecoponto:', erro);
      res.status(500).json({ mensagem: 'Erro ao remover o ponto de coleta.' });
    }
  });

  return router;
}

module.exports = { criarRotasEcopontos, MATERIAIS_VALIDOS };
