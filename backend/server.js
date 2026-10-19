require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const { enviarCodigoRecuperacao, enviarCupomRecompensa } = require('./email');

const app = express();
app.use(cors());
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_DIRECTORY = path.join(__dirname, 'uploads', 'profile');
const PROFILE_IMAGE_URL_PREFIX = '/uploads/profile/';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexão com o MySQL do XAMPP
const databaseConfig = {
  host: 'localhost',
  user: 'root',      
  port: 3307,
  password: '',      
  database: 'marketplace'
};
const db = mysql.createConnection(databaseConfig);
const transactionPool = mysql.createPool(databaseConfig);

let sessionsSchemaReady = false;
let notificationSchemaReady = false;
const NOTIFICATION_CATEGORIES = [
  'messages',
  'security',
  'listings',
  'transactions',
  'product_updates',
];
const DEFAULT_NOTIFICATION_PREFERENCES = {
  messages: true,
  security: true,
  listings: true,
  transactions: true,
  product_updates: false,
};

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
    return;
  }
  console.log('Conectado ao MySQL do XAMPP!');
  db.query(`
    CREATE TABLE IF NOT EXISTS sessao_usuario (
      id_sessao int(11) NOT NULL AUTO_INCREMENT,
      id_usuario int(11) NOT NULL,
      token_hash char(64) NOT NULL,
      dispositivo varchar(120) NOT NULL,
      criado_em datetime NOT NULL DEFAULT current_timestamp(),
      ultimo_acesso datetime NOT NULL DEFAULT current_timestamp(),
      expira_em datetime NOT NULL,
      revogado_em datetime DEFAULT NULL,
      PRIMARY KEY (id_sessao),
      UNIQUE KEY uk_sessao_token_hash (token_hash),
      KEY idx_sessao_usuario (id_usuario),
      CONSTRAINT sessao_usuario_fk FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `, (schemaError) => {
    if (schemaError) {
      console.error('Erro ao preparar tabela de sessões:', schemaError);
      return;
    }
    sessionsSchemaReady = true;
    db.query(`
      CREATE TABLE IF NOT EXISTS preferencia_notificacao (
        id_usuario int(11) NOT NULL,
        categoria varchar(40) NOT NULL,
        habilitada tinyint(1) NOT NULL,
        atualizado_em datetime NOT NULL DEFAULT current_timestamp()
          ON UPDATE current_timestamp(),
        PRIMARY KEY (id_usuario, categoria),
        CONSTRAINT preferencia_notificacao_usuario_fk FOREIGN KEY (id_usuario)
          REFERENCES usuario (id_usuario) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `, (preferenceError) => {
      if (preferenceError) {
        console.error('Erro ao preparar preferências de notificação:', preferenceError);
        return;
      }
      db.query(`
        CREATE TABLE IF NOT EXISTS dispositivo_notificacao (
          id_dispositivo int(11) NOT NULL AUTO_INCREMENT,
          id_usuario int(11) NOT NULL,
          id_sessao int(11) NOT NULL,
          expo_push_token varchar(255) NOT NULL,
          dispositivo varchar(120) NOT NULL,
          criado_em datetime NOT NULL DEFAULT current_timestamp(),
          ativo tinyint(1) NOT NULL DEFAULT 1,
          PRIMARY KEY (id_dispositivo),
          UNIQUE KEY uk_dispositivo_push_token (expo_push_token),
          UNIQUE KEY uk_dispositivo_sessao (id_sessao),
          KEY idx_dispositivo_usuario (id_usuario),
          CONSTRAINT dispositivo_notificacao_usuario_fk FOREIGN KEY (id_usuario)
            REFERENCES usuario (id_usuario) ON DELETE CASCADE,
          CONSTRAINT dispositivo_notificacao_sessao_fk FOREIGN KEY (id_sessao)
            REFERENCES sessao_usuario (id_sessao) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `, (deviceError) => {
        if (deviceError) {
          console.error('Erro ao preparar dispositivos de notificação:', deviceError);
          return;
        }
        notificationSchemaReady = true;
      });
    });
  });
});

function autenticarSessao(req, res, next) {
  if (!sessionsSchemaReady) {
    return res.status(503).json({ mensagem: 'O serviço de sessões ainda não está disponível.' });
  }
  const authorization = req.headers.authorization || '';
  const tokenMatch = authorization.match(/^Bearer ([a-f0-9]{64})$/i);
  if (!tokenMatch) {
    return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
  }

  const tokenHash = crypto.createHash('sha256').update(tokenMatch[1]).digest('hex');
  db.query(
    `SELECT id_sessao, id_usuario
     FROM sessao_usuario
     WHERE token_hash = ? AND revogado_em IS NULL AND expira_em > NOW()`,
    [tokenHash],
    (err, sessions) => {
      if (err) {
        console.error('Erro ao validar sessão:', err);
        return res.status(500).json({ mensagem: 'Erro interno ao validar a sessão.' });
      }
      if (sessions.length === 0) {
        return res.status(401).json({ mensagem: 'Sessão inválida ou expirada.' });
      }

      req.sessao = sessions[0];
      db.query(
        'UPDATE sessao_usuario SET ultimo_acesso = NOW() WHERE id_sessao = ?',
        [req.sessao.id_sessao],
        (updateError) => {
          if (updateError) {
            console.error('Erro ao atualizar atividade da sessão:', updateError);
            return res.status(500).json({ mensagem: 'Erro ao atualizar a sessão.' });
          }
          return next();
        }
      );
    }
  );
}

function enviarPushParaUsuario(idUsuario, categoria, titulo, corpo, ignorarSessao = null) {
  if (!notificationSchemaReady) {
    console.error('Notificação push ignorada: esquema de notificações ainda não está disponível.');
    return;
  }

  const filtroSessao = ignorarSessao ? 'AND s.id_sessao <> ?' : '';
  db.query(
    `SELECT d.id_dispositivo, d.expo_push_token
     FROM dispositivo_notificacao d
     JOIN sessao_usuario s ON s.id_sessao = d.id_sessao
     LEFT JOIN preferencia_notificacao p
       ON p.id_usuario = d.id_usuario AND p.categoria = ?
     WHERE d.id_usuario = ? AND d.ativo = 1
       AND s.revogado_em IS NULL AND s.expira_em > NOW()
       AND COALESCE(p.habilitada, ?) = 1
       ${filtroSessao}`,
    [categoria, idUsuario, DEFAULT_NOTIFICATION_PREFERENCES[categoria], ...(ignorarSessao ? [ignorarSessao] : [])],
    async (queryError, devices) => {
      if (queryError) {
        console.error('Erro ao selecionar dispositivos para push:', queryError);
        return;
      }
      for (const device of devices) {
        try {
          const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: device.expo_push_token,
              sound: 'default',
              title: titulo,
              body: corpo,
              data: {
                categoria,
                route: {
                  messages: '/chat',
                  security: '/privacidade_seguranca',
                  listings: '/anuncio_listagem',
                  transactions: '/minhas_avaliacoes',
                  product_updates: '/home',
                }[categoria],
              },
            }),
          });
          if (!pushResponse.ok) {
            console.error(`Expo Push recusou a notificação (HTTP ${pushResponse.status}).`);
            continue;
          }
          const result = await pushResponse.json();
          const ticket = result.data;
          if (ticket?.status === 'error') {
            if (ticket.details?.error === 'DeviceNotRegistered') {
              db.query('UPDATE dispositivo_notificacao SET ativo = 0 WHERE id_dispositivo = ?', [device.id_dispositivo], (disableError) => {
                if (disableError) console.error('Erro ao desativar token push inválido:', disableError);
              });
            } else {
              console.error('Expo Push retornou erro:', ticket.message || ticket.details?.error || 'Erro desconhecido.');
            }
          }
        } catch (pushError) {
          console.error('Erro ao enviar push pelo Expo:', pushError);
        }
      }
    }
  );
}

// --- ROTAS DE USUÁRIO ---

app.get('/usuario', (req, res) => {
  db.query('SELECT id_usuario, usuario_nome, email, tipo FROM usuario', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/usuario/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT id_usuario, usuario_nome, email, tipo, cpf_cnpj, foto_perfil, data_cadastro FROM usuario WHERE id_usuario = ?';

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuário:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }

    res.json(results[0]);
  });
});

app.put('/usuario/:id', async (req, res) => {
  const { id } = req.params;
  const { usuario_nome, tipo, foto_perfil } = req.body;

  if (typeof usuario_nome !== 'string' || typeof tipo !== 'string') {
    return res.status(400).json({ mensagem: 'Nome e tipo de conta são obrigatórios.' });
  }

  const nome = usuario_nome.trim();
  if (!nome || nome.length > 150) {
    return res.status(400).json({ mensagem: 'O nome deve conter entre 1 e 150 caracteres.' });
  }
  const tiposPermitidos = ['catador', 'cooperativa', 'industria', 'empresa', 'consumidor', 'admin'];
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({ mensagem: 'Tipo de conta inválido.' });
  }
  if (foto_perfil !== undefined && foto_perfil !== null) {
    if (typeof foto_perfil !== 'string') {
      return res.status(400).json({ mensagem: 'A foto de perfil é inválida.' });
    }

    if (foto_perfil.startsWith('data:image/jpeg;base64,')) {
      const conteudoBase64 = foto_perfil.slice('data:image/jpeg;base64,'.length);
      if (
        !/^[A-Za-z0-9+/]+={0,2}$/.test(conteudoBase64) ||
        Buffer.byteLength(conteudoBase64, 'base64') > MAX_PROFILE_IMAGE_SIZE
      ) {
        return res.status(400).json({ mensagem: 'A foto de perfil deve ser JPEG e ter até 5 MB.' });
      }
    } else if (!/^\/uploads\/profile\/[a-f0-9-]+\.jpg$/i.test(foto_perfil)) {
      return res.status(400).json({ mensagem: 'A foto de perfil enviada é inválida.' });
    }
  }

  let novaFotoSalva = null;
  try {
    const [rows] = await db.promise().query(
      'SELECT tipo, foto_perfil FROM usuario WHERE id_usuario = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }
    if ((rows[0].tipo === 'admin') !== (tipo === 'admin')) {
      return res.status(403).json({ mensagem: 'Não é permitido alterar o tipo de conta de administrador.' });
    }

    const fotoAnterior = rows[0].foto_perfil;
    let caminhoFoto = foto_perfil === undefined ? fotoAnterior : foto_perfil;

    if (typeof foto_perfil === 'string' && foto_perfil.startsWith('data:image/jpeg;base64,')) {
      const imagem = Buffer.from(foto_perfil.slice('data:image/jpeg;base64,'.length), 'base64');
      if (imagem.length < 3 || imagem[0] !== 0xff || imagem[1] !== 0xd8 || imagem[2] !== 0xff) {
        return res.status(400).json({ mensagem: 'O arquivo enviado não é uma imagem JPEG válida.' });
      }

      await fs.mkdir(PROFILE_IMAGE_DIRECTORY, { recursive: true });
      const nomeArquivo = `${crypto.randomUUID()}.jpg`;
      const caminhoArquivo = path.join(PROFILE_IMAGE_DIRECTORY, nomeArquivo);
      await fs.writeFile(caminhoArquivo, imagem, { flag: 'wx' });
      novaFotoSalva = caminhoArquivo;
      caminhoFoto = `${PROFILE_IMAGE_URL_PREFIX}${nomeArquivo}`;
    } else if (
      typeof foto_perfil === 'string' &&
      foto_perfil.startsWith(PROFILE_IMAGE_URL_PREFIX) &&
      foto_perfil !== fotoAnterior
    ) {
      return res.status(400).json({ mensagem: 'Não é permitido reutilizar o caminho de outra foto.' });
    }

    await db.promise().query(
      'UPDATE usuario SET usuario_nome = ?, tipo = ?, foto_perfil = ? WHERE id_usuario = ?',
      [nome, tipo, caminhoFoto, id]
    );
    novaFotoSalva = null;

    if (
      typeof fotoAnterior === 'string' &&
      fotoAnterior.startsWith(PROFILE_IMAGE_URL_PREFIX) &&
      fotoAnterior !== caminhoFoto
    ) {
      const nomeFotoAnterior = path.basename(fotoAnterior);
      try {
        await fs.unlink(path.join(PROFILE_IMAGE_DIRECTORY, nomeFotoAnterior));
      } catch (error) {
        console.error('Não foi possível remover a foto de perfil substituída:', error);
      }
    }

    const [updatedRows] = await db.promise().query(
      'SELECT id_usuario, usuario_nome, email, tipo, cpf_cnpj, foto_perfil, data_cadastro FROM usuario WHERE id_usuario = ?',
      [id]
    );
    if (updatedRows.length === 0) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }
    return res.json({
      mensagem: 'Perfil atualizado com sucesso.',
      usuario: updatedRows[0],
    });
  } catch (error) {
    if (novaFotoSalva) {
      try {
        await fs.unlink(novaFotoSalva);
      } catch (cleanupError) {
        console.error('Não foi possível remover uma foto de perfil não salva:', cleanupError);
      }
    }
    console.error('Erro ao atualizar perfil:', error);
    return res.status(500).json({ mensagem: 'Erro interno ao atualizar o perfil.' });
  }
});

app.post('/usuario/login', (req, res) => {
  const { email, senha, dispositivo } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ mensagem: 'E-mail e senha são obrigatórios.' });
  }

  const query = 'SELECT id_usuario, usuario_nome, email, tipo, senha_hash FROM usuario WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error('Erro na consulta:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }

    if (results.length === 0) {
      return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
    }

    const usuario = results[0];

    try {
      const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

      if (!senhaCorreta) {
        return res.status(401).json({ mensagem: 'E-mail ou senha incorretos.' });
      }

      if (!sessionsSchemaReady) {
        return res.status(503).json({ mensagem: 'O serviço de sessões ainda não está disponível.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const nomeDispositivo = typeof dispositivo === 'string' && dispositivo.trim()
        ? dispositivo.trim().slice(0, 120)
        : 'Dispositivo não identificado';
      db.query(
        `INSERT INTO sessao_usuario
          (id_usuario, token_hash, dispositivo, expira_em)
         VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [usuario.id_usuario, tokenHash, nomeDispositivo],
        (sessionError, sessionResult) => {
          if (sessionError) {
            console.error('Erro ao criar sessão de usuário:', sessionError);
            return res.status(500).json({ mensagem: 'Não foi possível iniciar uma sessão segura.' });
          }

          enviarPushParaUsuario(
            usuario.id_usuario,
            'security',
            'Novo acesso à sua conta',
            `Sua conta foi acessada em ${nomeDispositivo}.`,
            sessionResult.insertId
          );
          delete usuario.senha_hash;
          return res.status(200).json({
            mensagem: 'Login realizado com sucesso!',
            usuario,
            sessao: {
              id_sessao: sessionResult.insertId,
              token,
              expira_em: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          });
        }
      );
    } catch (compareError) {
      console.error('Erro ao comparar senha:', compareError);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
  });
});

app.get('/usuario/sessoes/ativas', autenticarSessao, (req, res) => {
  db.query(
    `SELECT id_sessao, dispositivo, criado_em, ultimo_acesso, expira_em,
      (id_sessao = ?) AS atual
     FROM sessao_usuario
     WHERE id_usuario = ? AND revogado_em IS NULL AND expira_em > NOW()
     ORDER BY atual DESC, ultimo_acesso DESC`,
    [req.sessao.id_sessao, req.sessao.id_usuario],
    (err, sessions) => {
      if (err) {
        console.error('Erro ao listar sessões do usuário:', err);
        return res.status(500).json({ mensagem: 'Não foi possível carregar os dispositivos conectados.' });
      }
      return res.json(sessions);
    }
  );
});

app.delete('/usuario/sessoes/:id_sessao', autenticarSessao, (req, res) => {
  const idSessao = Number(req.params.id_sessao);
  if (!Number.isInteger(idSessao) || idSessao < 1 || idSessao === req.sessao.id_sessao) {
    return res.status(400).json({ mensagem: 'Selecione uma sessão diferente da sessão atual.' });
  }

  db.query(
    `UPDATE sessao_usuario SET revogado_em = NOW()
     WHERE id_sessao = ? AND id_usuario = ? AND revogado_em IS NULL`,
    [idSessao, req.sessao.id_usuario],
    (err, result) => {
      if (err) {
        console.error('Erro ao encerrar sessão remota:', err);
        return res.status(500).json({ mensagem: 'Não foi possível encerrar essa sessão.' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ mensagem: 'Sessão não encontrada ou já encerrada.' });
      }
      db.query(
        'UPDATE dispositivo_notificacao SET ativo = 0 WHERE id_sessao = ?',
        [idSessao],
        (deviceError) => {
          if (deviceError) {
            console.error('Erro ao desativar push da sessão encerrada:', deviceError);
            return res.status(500).json({ mensagem: 'Sessão encerrada, mas houve erro ao desativar o dispositivo push.' });
          }
          enviarPushParaUsuario(
            req.sessao.id_usuario,
            'security',
            'Sessão encerrada',
            'Uma sessão de outro dispositivo foi encerrada.'
          );
          return res.json({ mensagem: 'Sessão encerrada.' });
        }
      );
    }
  );
});

app.delete('/usuario/sessao-atual', autenticarSessao, (req, res) => {
  db.query(
    'UPDATE sessao_usuario SET revogado_em = NOW() WHERE id_sessao = ?',
    [req.sessao.id_sessao],
    (err) => {
      if (err) {
        console.error('Erro ao encerrar sessão atual:', err);
        return res.status(500).json({ mensagem: 'Não foi possível encerrar a sessão.' });
      }
      db.query(
        'UPDATE dispositivo_notificacao SET ativo = 0 WHERE id_sessao = ?',
        [req.sessao.id_sessao],
        (deviceError) => {
          if (deviceError) {
            console.error('Erro ao desativar push da sessão atual:', deviceError);
            return res.status(500).json({ mensagem: 'Sessão encerrada, mas houve erro ao desativar o dispositivo push.' });
          }
          return res.json({ mensagem: 'Sessão encerrada.' });
        }
      );
    }
  );
});

app.post('/usuario/sessao-atual/atividade', autenticarSessao, (_req, res) => {
  return res.status(204).end();
});

app.get('/usuario/notificacoes/preferencias', autenticarSessao, (req, res) => {
  if (!notificationSchemaReady) {
    return res.status(503).json({ mensagem: 'As preferências de notificação ainda não estão disponíveis.' });
  }
  db.query(
    `SELECT categoria, habilitada
     FROM preferencia_notificacao WHERE id_usuario = ?`,
    [req.sessao.id_usuario],
    (preferenceError, preferences) => {
      if (preferenceError) {
        console.error('Erro ao carregar preferências de notificação:', preferenceError);
        return res.status(500).json({ mensagem: 'Não foi possível carregar as preferências.' });
      }
      const categories = { ...DEFAULT_NOTIFICATION_PREFERENCES };
      for (const preference of preferences) {
        if (Object.prototype.hasOwnProperty.call(categories, preference.categoria)) {
          categories[preference.categoria] = Boolean(preference.habilitada);
        }
      }
      db.query(
        'SELECT ativo FROM dispositivo_notificacao WHERE id_sessao = ?',
        [req.sessao.id_sessao],
        (deviceError, devices) => {
          if (deviceError) {
            console.error('Erro ao buscar inscrição push do dispositivo:', deviceError);
            return res.status(500).json({ mensagem: 'Não foi possível carregar o estado das notificações push.' });
          }
          return res.json({
            categorias: categories,
            push_ativo: devices.length > 0 && Boolean(devices[0].ativo),
          });
        }
      );
    }
  );
});

app.put('/usuario/notificacoes/preferencias', autenticarSessao, (req, res) => {
  if (!notificationSchemaReady) {
    return res.status(503).json({ mensagem: 'As preferências de notificação ainda não estão disponíveis.' });
  }
  const categorias = req.body?.categorias;
  if (!categorias || typeof categorias !== 'object' || Array.isArray(categorias)) {
    return res.status(400).json({ mensagem: 'Informe as preferências das categorias de notificação.' });
  }
  for (const category of NOTIFICATION_CATEGORIES) {
    if (typeof categorias[category] !== 'boolean') {
      return res.status(400).json({ mensagem: `A preferência "${category}" deve ser verdadeira ou falsa.` });
    }
  }

  const placeholders = NOTIFICATION_CATEGORIES.map(() => '(?, ?, ?)').join(', ');
  const values = NOTIFICATION_CATEGORIES.flatMap((category) => [
    req.sessao.id_usuario,
    category,
    categorias[category] ? 1 : 0,
  ]);
  db.query(
    `INSERT INTO preferencia_notificacao (id_usuario, categoria, habilitada)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE habilitada = VALUES(habilitada)`,
    values,
    (preferenceError) => {
      if (preferenceError) {
        console.error('Erro ao salvar preferências de notificação:', preferenceError);
        return res.status(500).json({ mensagem: 'Não foi possível salvar as preferências.' });
      }
      return res.json({ mensagem: 'Preferências de notificação atualizadas.' });
    }
  );
});

app.post('/usuario/notificacoes/dispositivo', autenticarSessao, (req, res) => {
  if (!notificationSchemaReady) {
    return res.status(503).json({ mensagem: 'O serviço de notificações ainda não está disponível.' });
  }
  const { expo_push_token, dispositivo } = req.body;
  if (
    typeof expo_push_token !== 'string' ||
    !/^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(expo_push_token) ||
    typeof dispositivo !== 'string' ||
    !dispositivo.trim()
  ) {
    return res.status(400).json({ mensagem: 'O token push ou nome do dispositivo é inválido.' });
  }
  db.query(
    `INSERT INTO dispositivo_notificacao
      (id_usuario, id_sessao, expo_push_token, dispositivo, ativo)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       id_usuario = VALUES(id_usuario),
       id_sessao = VALUES(id_sessao),
       expo_push_token = VALUES(expo_push_token),
       dispositivo = VALUES(dispositivo),
       ativo = 1`,
    [req.sessao.id_usuario, req.sessao.id_sessao, expo_push_token, dispositivo.trim().slice(0, 120)],
    (deviceError) => {
      if (deviceError) {
        console.error('Erro ao registrar dispositivo push:', deviceError);
        return res.status(500).json({ mensagem: 'Não foi possível registrar este dispositivo.' });
      }
      return res.status(201).json({ mensagem: 'Notificações push ativadas neste dispositivo.' });
    }
  );
});

app.delete('/usuario/notificacoes/dispositivo-atual', autenticarSessao, (req, res) => {
  db.query(
    'UPDATE dispositivo_notificacao SET ativo = 0 WHERE id_sessao = ? AND id_usuario = ?',
    [req.sessao.id_sessao, req.sessao.id_usuario],
    (deviceError) => {
      if (deviceError) {
        console.error('Erro ao desativar notificações push:', deviceError);
        return res.status(500).json({ mensagem: 'Não foi possível desativar notificações push.' });
      }
      return res.json({ mensagem: 'Notificações push desativadas neste dispositivo.' });
    }
  );
});

app.delete('/usuario/conta', autenticarSessao, async (req, res) => {
  if (!notificationSchemaReady) {
    return res.status(503).json({ mensagem: 'O serviço de privacidade ainda não está disponível.' });
  }
  const { senha } = req.body;
  if (typeof senha !== 'string' || !senha) {
    return res.status(400).json({ mensagem: 'Informe sua senha atual para confirmar a exclusão da conta.' });
  }

  db.query(
    'SELECT usuario_nome, email, senha_hash, cpf_cnpj, foto_perfil FROM usuario WHERE id_usuario = ?',
    [req.sessao.id_usuario],
    async (selectError, users) => {
      if (selectError) {
        console.error('Erro ao carregar conta para exclusão:', selectError);
        return res.status(500).json({ mensagem: 'Não foi possível validar a conta.' });
      }
      if (users.length === 0) {
        return res.status(404).json({ mensagem: 'Conta não encontrada.' });
      }

      let senhaCorreta;
      try {
        senhaCorreta = await bcrypt.compare(senha, users[0].senha_hash);
      } catch (compareError) {
        console.error('Erro ao validar senha para exclusão:', compareError);
        return res.status(500).json({ mensagem: 'Não foi possível validar a senha.' });
      }
      if (!senhaCorreta) {
        return res.status(401).json({ mensagem: 'A senha informada está incorreta.' });
      }

      const usuarioId = req.sessao.id_usuario;
      const fotoPerfil = users[0].foto_perfil;
      let conexao;
      try {
        const senhaInutilizavel = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        conexao = await new Promise((resolve, reject) => {
          transactionPool.getConnection((err, connection) => (err ? reject(err) : resolve(connection)));
        });
        await new Promise((resolve, reject) => {
          conexao.beginTransaction((err) => (err ? reject(err) : resolve()));
        });

        const consulta = (sql, parametros) => new Promise((resolve, reject) => {
          conexao.query(sql, parametros, (err, result) => (err ? reject(err) : resolve(result)));
        });

        await consulta(
          `UPDATE anuncio
           SET status = 'removido', anuncio_titulo = 'Anúncio de conta excluída',
               descricao = NULL, id_endereco = NULL
           WHERE id_usuario = ?`,
          [usuarioId]
        );
        await consulta(
          `UPDATE anuncio a
           JOIN endereco e ON e.id_endereco = a.id_endereco
           SET a.id_endereco = NULL
           WHERE e.id_usuario = ?`,
          [usuarioId]
        );
        await consulta(
          `DELETE img FROM imagens_anuncio img
           JOIN anuncio a ON a.id_anuncio = img.id_anuncio
           WHERE a.id_usuario = ?`,
          [usuarioId]
        );
        await consulta(
          `UPDATE mensagem
           SET conteudo = 'Mensagem removida por exclusão da conta', url_imagem = NULL
           WHERE id_remetente = ? OR id_destinatario = ?`,
          [usuarioId, usuarioId]
        );
        await consulta(
          `UPDATE avaliacao SET comentario = NULL WHERE id_avaliador = ?`,
          [usuarioId]
        );
        await consulta('DELETE FROM notificacao WHERE id_usuario = ?', [usuarioId]);
        await consulta('DELETE FROM codigo_recuperacao WHERE id_usuario = ?', [usuarioId]);
        await consulta('DELETE FROM preferencia_notificacao WHERE id_usuario = ?', [usuarioId]);
        await consulta('DELETE FROM dispositivo_notificacao WHERE id_usuario = ?', [usuarioId]);
        await consulta('DELETE FROM endereco WHERE id_usuario = ?', [usuarioId]);
        await consulta(
          `UPDATE usuario
           SET usuario_nome = 'Conta excluída',
               email = ?,
               senha_hash = ?,
               cpf_cnpj = NULL,
               foto_perfil = NULL
           WHERE id_usuario = ?`,
          [`conta-excluida-${usuarioId}@revira.invalid`, senhaInutilizavel, usuarioId]
        );
        await consulta(
          'DELETE FROM sessao_usuario WHERE id_usuario = ?',
          [usuarioId]
        );

        await new Promise((resolve, reject) => {
          conexao.commit((err) => (err ? reject(err) : resolve()));
        });
        conexao.release();
        conexao = null;

        if (fotoPerfil && fotoPerfil.startsWith(PROFILE_IMAGE_URL_PREFIX)) {
          const fotoPath = path.join(PROFILE_IMAGE_DIRECTORY, path.basename(fotoPerfil));
          fs.unlink(fotoPath).catch((unlinkError) => {
            if (unlinkError.code !== 'ENOENT') {
              console.error('Não foi possível remover foto após exclusão da conta:', unlinkError);
            }
          });
        }
        return res.json({
          mensagem: 'Conta apagada. Os dados pessoais foram anonimizados e as sessões encerradas.',
        });
      } catch (deleteError) {
        if (conexao) {
          await new Promise((resolve) => conexao.rollback(() => resolve()));
          conexao.release();
        }
        console.error('Erro ao anonimizar conta:', deleteError);
        return res.status(500).json({ mensagem: 'Não foi possível apagar a conta. Nenhum dado foi alterado.' });
      }
    }
  );
});

app.post('/usuario/cadastro', async (req, res) => {
  const { usuario_nome, email, senha, tipo } = req.body;

  if (!usuario_nome || !email || !senha || !tipo) {
    return res.status(400).json({ mensagem: 'Nome, e-mail, senha e tipo são obrigatórios.' });
  }

  const checkQuery = 'SELECT id_usuario FROM usuario WHERE email = ?';
  db.query(checkQuery, [email], async (err, results) => {
    if (err) {
      console.error('Erro ao verificar e-mail:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }

    if (results.length > 0) {
      return res.status(409).json({ mensagem: 'Este e-mail já está cadastrado.' });
    }

    try {
      const saltRounds = 10;
      const senhaHash = await bcrypt.hash(senha, saltRounds);

      const insertQuery = 'INSERT INTO usuario (usuario_nome, email, senha_hash, tipo) VALUES (?, ?, ?, ?)';
      db.query(insertQuery, [usuario_nome, email, senhaHash, tipo], (err, results) => {
        if (err) {
          console.error('Erro ao cadastrar usuário:', err);
          return res.status(500).json({ mensagem: 'Erro interno ao cadastrar usuário.' });
        }

        res.status(201).json({
          mensagem: 'Cadastro realizado com sucesso!',
          id_usuario: results.insertId
        });
      });
    } catch (hashError) {
      console.error('Erro ao gerar hash da senha:', hashError);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
  });
});

// --- ROTAS DE ANÚNCIOS ---

const getAnunciosHandler = (req, res) => {
  const query = `
    SELECT 
      a.id_anuncio,
      a.anuncio_titulo,
      a.descricao,
      a.quantidade,
      a.preco,
      a.status,
      a.criado_em,
      m.material_nome,
      m.categoria,
      m.unidade_medida,
      u.id_usuario,
      u.usuario_nome AS vendedor_nome,
      (
        SELECT img.anuncio_caminho_imagem 
        FROM imagens_anuncio img 
        WHERE img.id_anuncio = a.id_anuncio 
        ORDER BY img.ordem ASC LIMIT 1
      ) AS imagem_capa
    FROM anuncio a
    INNER JOIN material m ON a.id_material = m.id_material
    INNER JOIN usuario u ON a.id_usuario = u.id_usuario
    WHERE a.status = 'ativo'
    ORDER BY a.criado_em DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao buscar anúncios:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar anúncios.' });
    }
    res.json(results);
  });
};

app.get('/anuncios', getAnunciosHandler);
app.get('/anuncios_listagem', getAnunciosHandler);

app.get('/anuncios/:id', (req, res) => {
  const { id } = req.params;

  const queryAnuncio = `
    SELECT 
      a.id_anuncio,
      a.anuncio_titulo,
      a.descricao,
      a.quantidade,
      a.preco,
      a.status,
      a.criado_em,
      m.material_nome,
      m.categoria,
      m.unidade_medida,
      u.id_usuario,
      u.usuario_nome AS vendedor_nome,
      u.email AS vendedor_email,
      u.tipo AS vendedor_tipo,
      e.cidade,
      e.estado
    FROM anuncio a
    INNER JOIN material m ON a.id_material = m.id_material
    INNER JOIN usuario u ON a.id_usuario = u.id_usuario
    LEFT JOIN endereco e ON u.id_usuario = e.id_usuario
    WHERE a.id_anuncio = ?
    LIMIT 1
  `;

  db.query(queryAnuncio, [id], (err, results) => {
    if (err) {
      console.error('Erro ao buscar detalhes do anúncio:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ mensagem: 'Anúncio não encontrado.' });
    }

    const anuncio = results[0];

    const queryImagens = `
      SELECT anuncio_caminho_imagem 
      FROM imagens_anuncio 
      WHERE id_anuncio = ? 
      ORDER BY ordem ASC
    `;

    db.query(queryImagens, [id], (imgErr, imgResults) => {
      if (imgErr) {
        console.error('Erro ao buscar imagens:', imgErr);
        anuncio.imagens = [];
      } else {
        anuncio.imagens = imgResults.map((row) => row.anuncio_caminho_imagem);
      }

      res.json(anuncio);
    });
  });
});

app.post('/anuncios', (req, res) => {
  const { id_usuario, id_material, anuncio_titulo, descricao, quantidade, preco, imagem_url } = req.body;

  if (!id_usuario || !id_material || !anuncio_titulo || !quantidade || !preco) {
    return res.status(400).json({ mensagem: 'Preencha todos os campos obrigatórios.' });
  }

  const queryAnuncio = `
    INSERT INTO anuncio (id_usuario, id_material, anuncio_titulo, descricao, quantidade, preco, status)
    VALUES (?, ?, ?, ?, ?, ?, 'ativo')
  `;

  db.query(
    queryAnuncio,
    [id_usuario, id_material, anuncio_titulo.trim(), descricao ? descricao.trim() : null, quantidade, preco],
    (err, results) => {
      if (err) {
        console.error('Erro ao criar anúncio:', err);
        return res.status(500).json({ mensagem: 'Erro interno ao publicar anúncio.' });
      }

      const id_anuncio = results.insertId;

      if (imagem_url) {
        const queryImagem = 'INSERT INTO imagens_anuncio (id_anuncio, anuncio_caminho_imagem, ordem) VALUES (?, ?, 0)';
        db.query(queryImagem, [id_anuncio, imagem_url], (imgErr) => {
          if (imgErr) console.error('Erro ao salvar imagem do anúncio:', imgErr);
        });
      }

      res.status(201).json({
        mensagem: 'Anúncio publicado com sucesso!',
        id_anuncio
      });
    }
  );
});

// --- ROTAS DE MATERIAIS E FAVORITOS ---

app.get('/materiais', (req, res) => {
  db.query('SELECT id_material, material_nome, categoria, unidade_medida FROM material ORDER BY material_nome ASC', (err, results) => {
    if (err) {
      console.error('Erro ao buscar materiais:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar materiais.' });
    }
    res.json(results);
  });
});

app.get('/favoritos/:id_usuario', (req, res) => {
  const { id_usuario } = req.params;

  const query = `
    SELECT
      f.id_favorito,
      f.criado_em AS favorito_em,
      a.id_anuncio,
      a.anuncio_titulo,
      a.descricao,
      a.quantidade,
      a.preco,
      a.status,
      a.criado_em,
      m.material_nome,
      m.categoria,
      m.unidade_medida,
      u.id_usuario,
      u.usuario_nome AS vendedor_nome,
      (
        SELECT img.anuncio_caminho_imagem
        FROM imagens_anuncio img
        WHERE img.id_anuncio = a.id_anuncio
        ORDER BY img.ordem ASC LIMIT 1
      ) AS imagem_capa
    FROM favorito f
    INNER JOIN anuncio a ON a.id_anuncio = f.id_anuncio
    INNER JOIN material m ON m.id_material = a.id_material
    INNER JOIN usuario u ON u.id_usuario = a.id_usuario
    WHERE f.id_usuario = ?
    ORDER BY f.criado_em DESC
  `;

  db.query(query, [id_usuario], (err, results) => {
    if (err) {
      console.error('Erro ao buscar favoritos:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar favoritos.' });
    }

    res.json(results);
  });
});

app.get('/favoritos/:id_usuario/:id_anuncio', (req, res) => {
  const { id_usuario, id_anuncio } = req.params;

  const query = 'SELECT id_favorito FROM favorito WHERE id_usuario = ? AND id_anuncio = ? LIMIT 1';

  db.query(query, [id_usuario, id_anuncio], (err, results) => {
    if (err) {
      console.error('Erro ao verificar favorito:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao verificar favorito.' });
    }

    res.json({ favoritado: results.length > 0 });
  });
});

app.post('/favoritos', (req, res) => {
  const { id_usuario, id_anuncio } = req.body;

  if (!id_usuario || !id_anuncio) {
    return res.status(400).json({ mensagem: 'Usuário e anúncio são obrigatórios.' });
  }

  const checkQuery = 'SELECT id_favorito FROM favorito WHERE id_usuario = ? AND id_anuncio = ? LIMIT 1';

  db.query(checkQuery, [id_usuario, id_anuncio], (err, results) => {
    if (err) {
      console.error('Erro ao verificar favorito existente:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao atualizar favorito.' });
    }

    if (results.length > 0) {
      const deleteQuery = 'DELETE FROM favorito WHERE id_favorito = ?';
      return db.query(deleteQuery, [results[0].id_favorito], (deleteErr) => {
        if (deleteErr) {
          console.error('Erro ao remover favorito:', deleteErr);
          return res.status(500).json({ mensagem: 'Erro ao remover favorito.' });
        }

        return res.status(200).json({
          mensagem: 'Anúncio removido dos favoritos.',
          favoritado: false,
        });
      });
    }

    const insertQuery = 'INSERT INTO favorito (id_usuario, id_anuncio) VALUES (?, ?)';
    db.query(insertQuery, [id_usuario, id_anuncio], (insertErr, insertResults) => {
      if (insertErr) {
        console.error('Erro ao salvar favorito:', insertErr);
        return res.status(500).json({ mensagem: 'Erro ao salvar favorito.' });
      }

      res.status(201).json({
        mensagem: 'Anúncio adicionado aos favoritos.',
        favoritado: true,
        id_favorito: insertResults.insertId,
      });
    });
  });
});

app.post('/materiais', (req, res) => {
  const { material_nome, categoria, unidade_medida } = req.body;

  if (!material_nome || !categoria) {
    return res.status(400).json({ mensagem: 'Nome do material e categoria são obrigatórios.' });
  }

  const query = 'INSERT INTO material (material_nome, categoria, unidade_medida) VALUES (?, ?, ?)';
  db.query(
    query,
    [material_nome.trim(), categoria.trim(), unidade_medida ? unidade_medida.trim() : 'kg'],
    (err, results) => {
      if (err) {
        console.error('Erro ao cadastrar material:', err);
        return res.status(500).json({ mensagem: 'Erro interno ao cadastrar material.' });
      }

      res.status(201).json({
        mensagem: 'Material cadastrado com sucesso!',
        id_material: results.insertId,
        material_nome: material_nome.trim(),
        categoria: categoria.trim(),
        unidade_medida: unidade_medida ? unidade_medida.trim() : 'kg'
      });
    }
  );
});

// --- ROTAS DE ENDEREÇO ---

app.get('/endereco/usuario/:id_usuario', (req, res) => {
  const { id_usuario } = req.params;
  const query = 'SELECT id_endereco, id_usuario, logradouro, cidade, estado, cep FROM endereco WHERE id_usuario = ? ORDER BY id_endereco DESC';
  
  db.query(query, [id_usuario], (err, results) => {
    if (err) {
      console.error('Erro ao buscar endereços:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
    res.json(results);
  });
});

app.post('/endereco', (req, res) => {
  const { id_usuario, logradouro, cidade, estado, cep } = req.body;

  if (!id_usuario || !cidade || !estado) {
    return res.status(400).json({ mensagem: 'Usuário, cidade e estado são obrigatórios.' });
  }

  const query = 'INSERT INTO endereco (id_usuario, logradouro, cidade, estado, cep) VALUES (?, ?, ?, ?, ?)';
  
  db.query(query, [id_usuario, logradouro || null, cidade.trim(), estado.trim().toUpperCase(), cep || null], (err, results) => {
    if (err) {
      console.error('Erro ao cadastrar endereço:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao salvar endereço.' });
    }
    res.status(201).json({ mensagem: 'Endereço cadastrado com sucesso!', id_endereco: results.insertId });
  });
});

app.delete('/endereco/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM endereco WHERE id_endereco = ?';

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Erro ao deletar endereço:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao excluir endereço.' });
    }
    res.json({ mensagem: 'Endereço removido com sucesso!' });
  });
});

// --- ROTAS DE AVALIAÇÕES ---

app.post('/avaliacoes', (req, res) => {
  const { id_transacao, id_avaliador, id_avaliado, nota, comentario } = req.body;

  if (
    !Number.isInteger(Number(id_transacao)) ||
    Number(id_transacao) < 1 ||
    !Number.isInteger(Number(id_avaliador)) ||
    Number(id_avaliador) < 1 ||
    !Number.isInteger(Number(id_avaliado)) ||
    Number(id_avaliado) < 1 ||
    Number(id_avaliador) === Number(id_avaliado) ||
    !Number.isInteger(Number(nota)) ||
    Number(nota) < 1 ||
    Number(nota) > 5 ||
    (comentario !== undefined && comentario !== null && typeof comentario !== 'string')
  ) {
    return res.status(400).json({ mensagem: 'Informe a transação, os participantes e uma nota de 1 a 5.' });
  }

  const verificaTransacao = `
    SELECT t.id_transacao
    FROM transacao t
    JOIN anuncio a ON a.id_anuncio = t.id_anuncio
    WHERE t.id_transacao = ?
      AND t.status = 'concluida'
      AND (
        (t.id_comprador = ? AND a.id_usuario = ?)
        OR (t.id_comprador = ? AND a.id_usuario = ?)
      )
  `;

  db.query(
    verificaTransacao,
    [id_transacao, id_avaliador, id_avaliado, id_avaliado, id_avaliador],
    (verifyError, rows) => {
      if (verifyError) {
        console.error('Erro ao verificar transação para avaliação:', verifyError);
        return res.status(500).json({ mensagem: 'Erro interno ao validar a transação.' });
      }
      if (rows.length === 0) {
        return res.status(400).json({ mensagem: 'Apenas participantes podem avaliar uma transação concluída.' });
      }

      const query = 'INSERT INTO avaliacao (id_transacao, id_avaliador, id_avaliado, nota, comentario) VALUES (?, ?, ?, ?, ?)';
      db.query(query, [id_transacao, id_avaliador, id_avaliado, Number(nota), comentario?.trim() || null], (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ mensagem: 'Você já avaliou esta transação.' });
          }
          console.error('Erro ao salvar avaliação:', err);
          return res.status(500).json({ mensagem: 'Erro ao processar avaliação.' });
        }
        return res.status(201).json({ mensagem: 'Avaliação salva com sucesso!' });
      });
    }
  );
});

app.get('/usuarios/:id/avaliacoes/pendentes', (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT
      t.id_transacao,
      t.criado_em,
      t.valor_total,
      a.anuncio_titulo,
      CASE
        WHEN t.id_comprador = ? THEN a.id_usuario
        ELSE t.id_comprador
      END AS id_outro_usuario,
      CASE
        WHEN t.id_comprador = ? THEN vendedor.usuario_nome
        ELSE comprador.usuario_nome
      END AS outro_usuario_nome,
      CASE
        WHEN t.id_comprador = ? THEN vendedor.tipo
        ELSE comprador.tipo
      END AS outro_usuario_tipo
    FROM transacao t
    JOIN anuncio a ON a.id_anuncio = t.id_anuncio
    JOIN usuario comprador ON comprador.id_usuario = t.id_comprador
    JOIN usuario vendedor ON vendedor.id_usuario = a.id_usuario
    LEFT JOIN avaliacao av
      ON av.id_transacao = t.id_transacao
      AND av.id_avaliador = ?
    WHERE t.status = 'concluida'
      AND av.id_avaliacao IS NULL
      AND (
        t.id_comprador = ?
        OR a.id_usuario = ?
      )
      AND (t.id_comprador <> a.id_usuario)
    ORDER BY t.criado_em DESC
  `;

  db.query(query, [userId, userId, userId, userId, userId, userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar avaliações pendentes:', err);
      return res.status(500).json({ mensagem: 'Erro ao buscar transações pendentes de avaliação.' });
    }
    return res.json(results);
  });
});

app.get('/usuarios/:id/avaliacoes/recebidas', (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT a.*, u.usuario_nome AS avaliador_nome
    FROM avaliacao a 
    JOIN usuario u ON a.id_avaliador = u.id_usuario 
    WHERE a.id_avaliado = ?
    ORDER BY a.criado_em DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar avaliações recebidas:', err);
      return res.status(500).json({ mensagem: 'Erro ao buscar avaliações recebidas.' });
    }
    return res.json(results);
  });
});

app.get('/usuarios/:id/avaliacoes/feitas', (req, res) => {
  const userId = req.params.id;
  const query = `
    SELECT a.*, u.usuario_nome AS avaliado_nome
    FROM avaliacao a
    JOIN usuario u ON u.id_usuario = a.id_avaliado
    WHERE a.id_avaliador = ?
    ORDER BY a.criado_em DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar avaliações feitas:', err);
      return res.status(500).json({ mensagem: 'Erro ao buscar avaliações feitas.' });
    }
    return res.json(results);
  });
});

// --- ROTAS DE RECUPERAÇÃO DE SENHA ---
 
function gerarCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
 
app.post('/usuario/esqueci_senha', (req, res) => {
  const { email } = req.body;
 
  if (!email) {
    return res.status(400).json({ mensagem: 'E-mail é obrigatório.' });
  }
 
  const buscaUsuario = 'SELECT id_usuario FROM usuario WHERE email = ?';
  db.query(buscaUsuario, [email], (err, results) => {
    if (err) {
      console.error('Erro ao buscar usuário:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
 
    if (results.length === 0) {
      return res.status(200).json({ mensagem: 'Se o e-mail existir, um código foi enviado.' });
    }
 
    const idUsuario = results[0].id_usuario;
    const codigo = gerarCodigo();
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000);
 
    const insertQuery = 'INSERT INTO codigo_recuperacao (id_usuario, codigo, expira_em) VALUES (?, ?, ?)';
    db.query(insertQuery, [idUsuario, codigo, expiraEm], async (err) => {
      if (err) {
        console.error('Erro ao salvar código de recuperação:', err);
        return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
      }
 
      try {
        await enviarCodigoRecuperacao(email, codigo);
        return res.status(200).json({ mensagem: 'Se o e-mail existir, um código foi enviado.' });
      } catch (emailError) {
        console.error('Erro ao enviar e-mail:', emailError);
        return res.status(500).json({ mensagem: 'Erro ao enviar e-mail de recuperação.' });
      }
    });
  });
});
 
app.post('/usuario/verificar_codigo', (req, res) => {
  const { email, codigo } = req.body;
 
  if (!email || !codigo) {
    return res.status(400).json({ mensagem: 'E-mail e código são obrigatórios.' });
  }
 
  const query = `
    SELECT cr.id_codigo, cr.expira_em, cr.usado
    FROM codigo_recuperacao cr
    JOIN usuario u ON u.id_usuario = cr.id_usuario
    WHERE u.email = ? AND cr.codigo = ?
    ORDER BY cr.id_codigo DESC
    LIMIT 1
  `;
 
  db.query(query, [email, codigo], (err, results) => {
    if (err) {
      console.error('Erro ao verificar código:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
 
    if (results.length === 0) {
      return res.status(400).json({ mensagem: 'Código inválido.' });
    }
 
    const registro = results[0];
 
    if (registro.usado) {
      return res.status(400).json({ mensagem: 'Este código já foi utilizado.' });
    }
 
    if (new Date(registro.expira_em) < new Date()) {
      return res.status(400).json({ mensagem: 'Este código expirou. Solicite um novo.' });
    }
 
    return res.status(200).json({ mensagem: 'Código válido.' });
  });
});
 
app.post('/usuario/redefinir_senha', async (req, res) => {
  const { email, codigo, novaSenha } = req.body;
 
  if (!email || !codigo || !novaSenha) {
    return res.status(400).json({ mensagem: 'E-mail, código e nova senha são obrigatórios.' });
  }
 
  if (novaSenha.length < 6) {
    return res.status(400).json({ mensagem: 'A senha deve ter pelo menos 6 caracteres.' });
  }
 
  const query = `
    SELECT cr.id_codigo, cr.expira_em, cr.usado, u.id_usuario
    FROM codigo_recuperacao cr
    JOIN usuario u ON u.id_usuario = cr.id_usuario
    WHERE u.email = ? AND cr.codigo = ?
    ORDER BY cr.id_codigo DESC
    LIMIT 1
  `;
 
  db.query(query, [email, codigo], async (err, results) => {
    if (err) {
      console.error('Erro ao verificar código:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
 
    if (results.length === 0) {
      return res.status(400).json({ mensagem: 'Código inválido.' });
    }
 
    const registro = results[0];
 
    if (registro.usado) {
      return res.status(400).json({ mensagem: 'Este código já foi utilizado.' });
    }
 
    if (new Date(registro.expira_em) < new Date()) {
      return res.status(400).json({ mensagem: 'Este código expirou. Solicite um novo.' });
    }
 
    try {
      const saltRounds = 10;
      const senhaHash = await bcrypt.hash(novaSenha, saltRounds);
      let conexao;
      try {
        conexao = await new Promise((resolve, reject) => {
          transactionPool.getConnection((connectionError, connection) =>
            connectionError ? reject(connectionError) : resolve(connection)
          );
        });
        await new Promise((resolve, reject) => {
          conexao.beginTransaction((transactionError) =>
            transactionError ? reject(transactionError) : resolve()
          );
        });

        const executar = (sql, parametros) => new Promise((resolve, reject) => {
          conexao.query(sql, parametros, (queryError, result) =>
            queryError ? reject(queryError) : resolve(result)
          );
        });
        const codigoAtualizado = await executar(
          `UPDATE codigo_recuperacao SET usado = 1
           WHERE id_codigo = ? AND usado = 0 AND expira_em > NOW()`,
          [registro.id_codigo]
        );
        if (codigoAtualizado.affectedRows === 0) {
          await new Promise((resolve) => conexao.rollback(() => resolve()));
          conexao.release();
          return res.status(400).json({ mensagem: 'Este código já foi utilizado ou expirou.' });
        }

        await executar('UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?', [
          senhaHash,
          registro.id_usuario,
        ]);
        await executar(
          'UPDATE sessao_usuario SET revogado_em = NOW() WHERE id_usuario = ? AND revogado_em IS NULL',
          [registro.id_usuario]
        );
        await executar(
          'UPDATE dispositivo_notificacao SET ativo = 0 WHERE id_usuario = ?',
          [registro.id_usuario]
        );
        await new Promise((resolve, reject) => {
          conexao.commit((commitError) => (commitError ? reject(commitError) : resolve()));
        });
        conexao.release();
        return res.status(200).json({ mensagem: 'Senha redefinida e sessões encerradas com sucesso.' });
      } catch (resetError) {
        if (conexao) {
          await new Promise((resolve) => conexao.rollback(() => resolve()));
          conexao.release();
        }
        throw resetError;
      }
    } catch (hashError) {
      console.error('Erro ao gerar hash da senha:', hashError);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
  });
});

// --- ROTAS DE COLETA ---

app.get('/coletas/usuario/:id_usuario', (req, res) => {
  const { id_usuario } = req.params;
  const query = `
    SELECT c.id_coleta, c.data_coleta, c.status, a.anuncio_titulo, a.quantidade,
      m.material_nome, m.unidade_medida, e.logradouro, e.cidade, e.estado
    FROM coleta c
    INNER JOIN transacao t ON c.id_transacao = t.id_transacao
    INNER JOIN anuncio a ON t.id_anuncio = a.id_anuncio
    INNER JOIN material m ON a.id_material = m.id_material
    LEFT JOIN endereco e ON c.id_endereco = e.id_endereco
    WHERE t.id_comprador = ? OR a.id_usuario = ?
    ORDER BY c.id_coleta DESC
  `;

  db.query(query, [id_usuario, id_usuario], (err, results) => {
    if (err) {
      console.error('Erro ao buscar coletas:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar coletas.' });
    }
    res.json(results);
  });
});

app.get('/transacoes/usuario/:id_usuario/disponiveis', (req, res) => {
  const { id_usuario } = req.params;
  const query = `
    SELECT t.id_transacao, a.anuncio_titulo, m.material_nome
    FROM transacao t
    INNER JOIN anuncio a ON t.id_anuncio = a.id_anuncio
    INNER JOIN material m ON a.id_material = m.id_material
    LEFT JOIN coleta c ON c.id_transacao = t.id_transacao
    WHERE c.id_coleta IS NULL AND (t.id_comprador = ? OR a.id_usuario = ?)
    ORDER BY t.id_transacao DESC
  `;

  db.query(query, [id_usuario, id_usuario], (err, results) => {
    if (err) {
      console.error('Erro ao buscar transações:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
    res.json(results);
  });
});

app.post('/coletas', (req, res) => {
  const { id_transacao, id_endereco, data_coleta } = req.body;

  if (!id_transacao || !id_endereco || !data_coleta) {
    return res.status(400).json({ mensagem: 'Transação, endereço e data são obrigatórios.' });
  }

  const query = "INSERT INTO coleta (id_transacao, id_endereco, data_coleta, status) VALUES (?, ?, ?, 'agendada')";

  db.query(query, [id_transacao, id_endereco, data_coleta], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ mensagem: 'Esta transação já tem uma coleta.' });
      }
      console.error('Erro ao agendar coleta:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao agendar coleta.' });
    }
    res.status(201).json({ mensagem: 'Coleta agendada com sucesso!', id_coleta: results.insertId });
  });
});

app.put('/coletas/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const statusValidos = ['agendada', 'em_andamento', 'concluida', 'cancelada'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ mensagem: 'Status inválido.' });
  }

  db.query('UPDATE coleta SET status = ? WHERE id_coleta = ?', [status, id], (err, results) => {
    if (err) {
      console.error('Erro ao atualizar coleta:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao atualizar coleta.' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Coleta não encontrada.' });
    }
    res.json({ mensagem: 'Status atualizado com sucesso!' });
  });
});

// --- ROTAS DE MENSAGENS (CHAT) ---

app.get('/mensagens', (req, res) => {
  const { id_anuncio, id_usuario, id_outro } = req.query;

  if (!id_anuncio || !id_usuario || !id_outro) {
    return res.status(400).json({ mensagem: 'id_anuncio, id_usuario e id_outro são obrigatórios.' });
  }

  const query = `
    SELECT m.id_mensagem, m.id_remetente, m.id_destinatario, m.conteudo, m.lida,
           m.enviado_em, m.url_imagem, m.id_proposta,
           p.endereco AS proposta_endereco,
           p.data_hora AS proposta_data_hora,
           p.quantidade AS proposta_quantidade,
           p.status AS proposta_status,
           p.id_proponente AS proposta_proponente
    FROM mensagem m
    LEFT JOIN proposta p ON p.id_proposta = m.id_proposta
    WHERE m.id_anuncio = ?
      AND ((m.id_remetente = ? AND m.id_destinatario = ?)
        OR (m.id_remetente = ? AND m.id_destinatario = ?))
    ORDER BY m.enviado_em ASC, m.id_mensagem ASC
  `;

  db.query(query, [id_anuncio, id_usuario, id_outro, id_outro, id_usuario], (err, results) => {
    if (err) {
      console.error('Erro ao buscar mensagens:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar mensagens.' });
    }
    res.json(results);
  });
});

app.post('/mensagens', (req, res) => {
  const { conteudo, id_remetente, id_destinatario, id_anuncio, url_imagem } = req.body;

  if (!id_remetente || !id_anuncio) {
    return res.status(400).json({ mensagem: 'Remetente e anúncio são obrigatórios.' });
  }

  db.query('SELECT id_usuario FROM anuncio WHERE id_anuncio = ?', [id_anuncio], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar anúncio:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
    if (rows.length === 0) {
      return res.status(404).json({ mensagem: 'Anúncio não encontrado.' });
    }

    const idVendedor = Number(rows[0].id_usuario);

    const destinatario =
      Number(id_remetente) === idVendedor ? Number(id_destinatario) : idVendedor;

    if (!destinatario) {
      return res.status(400).json({ mensagem: 'Informe o comprador ao responder como vendedor.' });
    }
    if (destinatario === Number(id_remetente)) {
      return res.status(400).json({ mensagem: 'Você não pode enviar mensagem para si mesmo.' });
    }

    const query = 'INSERT INTO mensagem (conteudo, id_remetente, id_destinatario, id_anuncio, url_imagem) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [conteudo || '', id_remetente, destinatario, id_anuncio, url_imagem || null], (err, results) => {
      if (err) {
        console.error('Erro ao salvar mensagem:', err);
        return res.status(500).json({ mensagem: 'Erro interno ao salvar mensagem.' });
      }

      // Envio de notificação push
      db.query(
        'SELECT usuario_nome FROM usuario WHERE id_usuario = ?',
        [id_remetente],
        (senderError, senders) => {
          if (senderError) {
            console.error('Erro ao buscar remetente para notificação de mensagem:', senderError);
            return;
          }
          const senderName = senders[0]?.usuario_nome || 'Alguém';
          enviarPushParaUsuario(
            Number(destinatario),
            'messages',
            `Nova mensagem de ${senderName}`,
            'Abra o Revira para ver sua mensagem.'
          );
        }
      );

      res.status(201).json({ mensagem: 'Mensagem salva com sucesso', id: results.insertId });
    });
  });
});

app.get('/conversas', (req, res) => {
  const { id_usuario } = req.query;
  if (!id_usuario) {
    return res.status(400).json({ mensagem: 'id_usuario é obrigatório.' });
  }

  const query = `
    SELECT m.id_anuncio, a.anuncio_titulo,
           CASE WHEN m.id_remetente = ? THEN m.id_destinatario ELSE m.id_remetente END AS id_outro,
           u.usuario_nome AS outro_nome,
           m.conteudo, m.url_imagem, m.id_proposta, m.enviado_em
    FROM mensagem m
    JOIN (
      SELECT id_anuncio,
             LEAST(id_remetente, id_destinatario) AS u1,
             GREATEST(id_remetente, id_destinatario) AS u2,
             MAX(id_mensagem) AS ultima
      FROM mensagem
      WHERE id_anuncio IS NOT NULL AND (id_remetente = ? OR id_destinatario = ?)
      GROUP BY id_anuncio, u1, u2
    ) ult ON ult.ultima = m.id_mensagem
    JOIN anuncio a ON a.id_anuncio = m.id_anuncio
    JOIN usuario u ON u.id_usuario =
      CASE WHEN m.id_remetente = ? THEN m.id_destinatario ELSE m.id_remetente END
    ORDER BY m.enviado_em DESC
  `;

  db.query(query, [id_usuario, id_usuario, id_usuario, id_usuario], (err, results) => {
    if (err) {
      console.error('Erro ao buscar conversas:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar conversas.' });
    }
    res.json(results);
  });
});

// --- ROTAS DE PROPOSTAS E TRANSAÇÕES ---

app.post('/propostas', (req, res) => {
  const { id_anuncio, id_proponente, id_destinatario, endereco, data_hora, quantidade } = req.body;

  if (!id_anuncio || !id_proponente || !id_destinatario || !endereco || !data_hora || !quantidade) {
    return res.status(400).json({ mensagem: 'Preencha endereço, data, horário e quantidade.' });
  }

  if (Number(id_proponente) === Number(id_destinatario)) {
    return res.status(400).json({ mensagem: 'Você não pode fazer acordo consigo mesmo.' });
  }

  db.query('SELECT id_usuario, quantidade, status FROM anuncio WHERE id_anuncio = ?', [id_anuncio], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar anúncio:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
    if (rows.length === 0) return res.status(404).json({ mensagem: 'Anúncio não encontrado.' });

    const anuncio = rows[0];

    if (anuncio.status !== 'ativo') {
      return res.status(400).json({ mensagem: 'Este anúncio não está mais ativo.' });
    }
    if (![Number(id_proponente), Number(id_destinatario)].includes(Number(anuncio.id_usuario))) {
      return res.status(400).json({ mensagem: 'Participantes inválidos para este anúncio.' });
    }
    if (Number(quantidade) <= 0 || Number(quantidade) > Number(anuncio.quantidade)) {
      return res.status(400).json({ mensagem: `Quantidade inválida. O anúncio tem ${anuncio.quantidade} disponível.` });
    }

    const insertProposta = `
      INSERT INTO proposta (id_anuncio, id_proponente, id_destinatario, endereco, data_hora, quantidade)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.query(insertProposta, [id_anuncio, id_proponente, id_destinatario, endereco.trim(), data_hora, quantidade], (err, result) => {
      if (err) {
        console.error('Erro ao criar proposta:', err);
        return res.status(500).json({ mensagem: 'Erro interno ao criar proposta.' });
      }

      const id_proposta = result.insertId;
      const insertMsg = `
        INSERT INTO mensagem (conteudo, id_remetente, id_destinatario, id_anuncio, id_proposta)
        VALUES ('Proposta de acordo', ?, ?, ?, ?)
      `;
      db.query(insertMsg, [id_proponente, id_destinatario, id_anuncio, id_proposta], (err) => {
        if (err) {
          console.error('Erro ao criar mensagem da proposta:', err);
          return res.status(500).json({ mensagem: 'Erro interno ao enviar proposta.' });
        }
        res.status(201).json({ mensagem: 'Proposta enviada!', id_proposta });
      });
    });
  });
});

app.put('/propostas/:id/responder', (req, res) => {
  const { id } = req.params;
  const { id_usuario, aceitar } = req.body;

  if (!id_usuario || typeof aceitar !== 'boolean') {
    return res.status(400).json({ mensagem: 'id_usuario e aceitar são obrigatórios.' });
  }

  const novoStatus = aceitar ? 'aceita' : 'recusada';

  const update = `
    UPDATE proposta SET status = ?
    WHERE id_proposta = ? AND id_destinatario = ? AND status = 'pendente'
  `;
  db.query(update, [novoStatus, id, id_usuario], (err, result) => {
    if (err) {
      console.error('Erro ao responder proposta:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
    if (result.affectedRows === 0) {
      return res.status(409).json({ mensagem: 'Proposta não encontrada, já respondida, ou você não é o destinatário.' });
    }
    if (!aceitar) {
      return res.json({ mensagem: 'Proposta recusada.' });
    }

    const busca = `
      SELECT p.*, a.id_usuario AS id_vendedor, a.preco
      FROM proposta p
      JOIN anuncio a ON a.id_anuncio = p.id_anuncio
      WHERE p.id_proposta = ?
    `;
    db.query(busca, [id], (err, rows) => {
      if (err || rows.length === 0) {
        console.error('Erro ao buscar proposta aceita:', err);
        return res.status(500).json({ mensagem: 'Proposta aceita, mas falhou ao criar a transação.' });
      }

      const p = rows[0];
      const idComprador = Number(p.id_vendedor) === Number(p.id_proponente) ? p.id_destinatario : p.id_proponente;
      const valorTotal = Number(p.quantidade) * Number(p.preco);

      const insertTransacao = `
        INSERT INTO transacao (id_proposta, id_anuncio, id_comprador, quantidade, valor_total, endereco, data_hora, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada')
      `;
      db.query(
        insertTransacao,
        [p.id_proposta, p.id_anuncio, idComprador, p.quantidade, valorTotal, p.endereco, p.data_hora],
        (err, r) => {
          if (err) {
            console.error('Erro ao criar transação:', err);
            return res.status(500).json({ mensagem: 'Proposta aceita, mas falhou ao criar a transação.' });
          }
          res.status(201).json({ mensagem: 'Acordo fechado!', id_transacao: r.insertId });
        }
      );
    });
  });
});

// --- ROTAS DE TRANSAÇÕES ---

app.get('/transacoes', (req, res) => {
  const { id_usuario } = req.query;
  if (!id_usuario) {
    return res.status(400).json({ mensagem: 'id_usuario é obrigatório.' });
  }

  const query = `
    SELECT t.id_transacao, t.id_anuncio, a.anuncio_titulo,
           m.material_nome, m.unidade_medida,
           t.quantidade, t.valor_total, t.endereco, t.data_hora, t.status,
           t.id_comprador, a.id_usuario AS id_vendedor,
           uc.usuario_nome AS comprador_nome,
           uv.usuario_nome AS vendedor_nome,
           EXISTS (SELECT 1 FROM avaliacao av
                   WHERE av.id_transacao = t.id_transacao
                     AND av.id_avaliador = ?) AS ja_avaliei
    FROM transacao t
    JOIN anuncio a ON a.id_anuncio = t.id_anuncio
    JOIN material m ON m.id_material = a.id_material
    JOIN usuario uc ON uc.id_usuario = t.id_comprador
    JOIN usuario uv ON uv.id_usuario = a.id_usuario
    WHERE t.id_comprador = ? OR a.id_usuario = ?
    ORDER BY t.criado_em DESC
  `;

  db.query(query, [id_usuario, id_usuario, id_usuario], (err, results) => {
    if (err) {
      console.error('Erro ao buscar transações:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar transações.' });
    }
    res.json(results);
  });
});

app.post('/transacoes', (req, res) => {
  const { id_anuncio, id_comprador } = req.body;

  if (!id_anuncio || !id_comprador) {
    return res.status(400).json({ mensagem: 'Anúncio e comprador são obrigatórios.' });
  }

  db.query('SELECT id_usuario, preco, status FROM anuncio WHERE id_anuncio = ?', [id_anuncio], (err, results) => {
    if (err) {
      console.error('Erro ao buscar anúncio:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ mensagem: 'Anúncio não encontrado.' });
    }

    const anuncio = results[0];

    if (anuncio.status !== 'ativo') {
      return res.status(400).json({ mensagem: 'Este anúncio não está mais disponível.' });
    }

    if (anuncio.id_usuario === Number(id_comprador)) {
      return res.status(400).json({ mensagem: 'Você não pode comprar o seu próprio anúncio.' });
    }

    const queryExistente = "SELECT id_transacao FROM transacao WHERE id_anuncio = ? AND id_comprador = ? AND status <> 'cancelada'";
    db.query(queryExistente, [id_anuncio, id_comprador], (err, existentes) => {
      if (err) {
        console.error('Erro ao verificar transação:', err);
        return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
      }

      if (existentes.length > 0) {
        return res.status(409).json({ mensagem: 'Você já tem uma compra em andamento para este anúncio.' });
      }

      const queryInsert = "INSERT INTO transacao (id_anuncio, id_comprador, valor_total, status) VALUES (?, ?, ?, 'pendente')";
      db.query(queryInsert, [id_anuncio, id_comprador, anuncio.preco], (err, resultado) => {
        if (err) {
          console.error('Erro ao criar transação:', err);
          return res.status(500).json({ mensagem: 'Erro interno ao registrar a compra.' });
        }

        res.status(201).json({
          mensagem: 'Compra registrada com sucesso!',
          id_transacao: resultado.insertId
        });
      });
    });
  });
});

app.put('/transacoes/:id/status', (req, res) => {
  const { id } = req.params;
  const { id_usuario, status } = req.body;

  if (!id_usuario || !['concluida', 'cancelada'].includes(status)) {
    return res.status(400).json({ mensagem: 'Dados inválidos.' });
  }

  const query = `
    UPDATE transacao t
    JOIN anuncio a ON a.id_anuncio = t.id_anuncio
    SET t.status = ?
    WHERE t.id_transacao = ?
      AND t.status IN ('pendente', 'confirmada', 'em_transporte')
      AND (t.id_comprador = ? OR a.id_usuario = ?)
  `;

  db.query(query, [status, id, id_usuario, id_usuario], (err, result) => {
    if (err) {
      console.error('Erro ao atualizar transação:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
    if (result.affectedRows === 0) {
      return res.status(409).json({ mensagem: 'Transação não encontrada, já finalizada, ou você não participa dela.' });
    }
    res.json({ mensagem: status === 'concluida' ? 'Transação concluída!' : 'Transação cancelada.' });
  });
});

// --- ROTAS DE RECOMPENSAS ---

app.get('/recompensas', (req, res) => {
  const sql = `
    SELECT r.*, u.usuario_nome AS parceiro 
    FROM recompensa r
    JOIN usuario u ON r.id_empresa = u.id_usuario
    WHERE r.quantidade > 0
    ORDER BY r.id_recompensa DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(results);
  });
});

app.post('/recompensas', (req, res) => {
  const { id_empresa, titulo, descricao, custo_pontos, quantidade, icone, cor } = req.body;
  const sql = `INSERT INTO recompensa (id_empresa, titulo, descricao, custo_pontos, quantidade, icone, cor) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
  db.query(sql, [id_empresa, titulo, descricao, custo_pontos, quantidade, icone || 'gift-outline', cor || '#2E7D32'], (err, result) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.status(201).json({ id_recompensa: result.insertId, mensagem: 'Recompensa cadastrada!' });
  });
});

// RESGATAR RECOMPENSA (Gera cupão, envia e-mail e reduz quantidade)
app.post('/recompensas/resgatar', (req, res) => {
  const { id_usuario, email, id_recompensa, titulo_recompensa } = req.body;

  if (!id_usuario || !email || !id_recompensa) {
    return res.status(400).json({ mensagem: 'Dados incompletos para resgate.' });
  }

  // 1. Verificar se ainda há stock da recompensa
  const checkQuery = 'SELECT quantidade FROM recompensa WHERE id_recompensa = ?';
  db.query(checkQuery, [id_recompensa], (err, results) => {
    if (err) return res.status(500).json({ erro: 'Erro interno.' });
    if (results.length === 0 || results[0].quantidade <= 0) {
      return res.status(400).json({ mensagem: 'Esta recompensa já esgotou.' });
    }

    // 2. Diminuir a quantidade em 1 no catálogo
    const updateQuery = 'UPDATE recompensa SET quantidade = quantidade - 1 WHERE id_recompensa = ?';
    db.query(updateQuery, [id_recompensa], async (errUpdate) => {
      if (errUpdate) return res.status(500).json({ erro: 'Erro ao atualizar stock.' });

      // 3. Gerar código alfanumérico aleatório de 8 caracteres para o cupão
      const codigoCupom = Math.random().toString(36).substring(2, 10).toUpperCase();

      // 4. Enviar e-mail ao utilizador
      try {
        await enviarCupomRecompensa(email, titulo_recompensa, codigoCupom);
        res.status(200).json({ 
          mensagem: 'Resgate realizado com sucesso! E-mail enviado.', 
          codigo: codigoCupom 
        });
      } catch (mailErr) {
        console.error('Erro ao enviar e-mail de resgate:', mailErr);
        res.status(500).json({ mensagem: 'Resgate feito, mas falhou ao enviar o e-mail.' });
      }
    });
  });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});