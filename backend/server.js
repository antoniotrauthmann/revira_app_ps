const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const { enviarCodigoRecuperacao } = require('./email');

const app = express();
app.use(cors());
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const PROFILE_IMAGE_DIRECTORY = path.join(__dirname, 'uploads', 'profile');
const PROFILE_IMAGE_URL_PREFIX = '/uploads/profile/';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexão com o MySQL do XAMPP
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',      
  port: 3307,
  password: '',      
  database: 'marketplace'
});

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
    return;
  }
  console.log('Conectado ao MySQL do XAMPP!');
});

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
  const { email, senha } = req.body;

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

      delete usuario.senha_hash;

      return res.status(200).json({
        mensagem: 'Login realizado com sucesso!',
        usuario
      });
    } catch (compareError) {
      console.error('Erro ao comparar senha:', compareError);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
  });
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

// --- ROTAS DE MATERIAIS ---

app.get('/materiais', (req, res) => {
  db.query('SELECT id_material, material_nome, categoria, unidade_medida FROM material ORDER BY material_nome ASC', (err, results) => {
    if (err) {
      console.error('Erro ao buscar materiais:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao buscar materiais.' });
    }
    res.json(results);
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

// --- ROTAS DE MENSAGENS (CHAT) ---

app.get('/mensagens', (req, res) => {
  const query = 'SELECT id_mensagem, id_remetente, id_destinatario, conteudo, lida, enviado_em, url_imagem FROM mensagem ORDER BY enviado_em ASC';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erro ao buscar mensagens:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.post('/mensagens', (req, res) => {
  const { conteudo, id_remetente, id_destinatario, url_imagem } = req.body;

  const query = 'INSERT INTO mensagem (conteudo, id_remetente, id_destinatario, url_imagem) VALUES (?, ?, ?, ?)';
  
  db.query(query, [conteudo, id_remetente, id_destinatario, url_imagem || null], (err, results) => {
    if (err) {
      console.error('Erro ao salvar mensagem:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao salvar mensagem.' });
    }
    res.status(201).json({ mensagem: 'Mensagem salva com sucesso', id: results.insertId });
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
 
      const updateQuery = 'UPDATE usuario SET senha_hash = ? WHERE id_usuario = ?';
      db.query(updateQuery, [senhaHash, registro.id_usuario], (err) => {
        if (err) {
          console.error('Erro ao atualizar senha:', err);
          return res.status(500).json({ mensagem: 'Erro interno ao atualizar senha.' });
        }
 
        const marcaUsado = 'UPDATE codigo_recuperacao SET usado = 1 WHERE id_codigo = ?';
        db.query(marcaUsado, [registro.id_codigo], (err) => {
          if (err) console.error('Erro ao marcar código como usado:', err);
        });
 
        return res.status(200).json({ mensagem: 'Senha redefinida com sucesso!' });
      });
    } catch (hashError) {
      console.error('Erro ao gerar hash da senha:', hashError);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
  });
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 3000');
});