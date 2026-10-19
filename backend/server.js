const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { enviarCodigoRecuperacao } = require('./email');

const app = express();
app.use(cors());

// Limite expandido para permitir o envio de imagens em Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Conexão com o MySQL do XAMPP
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',      
  port: 3306,
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
  const query = 'SELECT id_usuario, usuario_nome, email, tipo, cpf_cnpj, data_cadastro FROM usuario WHERE id_usuario = ?';

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

  if (!id_transacao || !id_avaliador || !id_avaliado || !nota) {
    return res.status(400).json({ mensagem: 'Dados incompletos.' });
  }
  if (Number(nota) < 1 || Number(nota) > 5) {
    return res.status(400).json({ mensagem: 'A nota deve ser de 1 a 5.' });
  }
  if (Number(id_avaliador) === Number(id_avaliado)) {
    return res.status(400).json({ mensagem: 'Você não pode se autoavaliar.' });
  }

  const busca = `
    SELECT t.status, t.id_comprador, a.id_usuario AS id_vendedor
    FROM transacao t
    JOIN anuncio a ON a.id_anuncio = t.id_anuncio
    WHERE t.id_transacao = ?
  `;
  db.query(busca, [id_transacao], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar transação:', err);
      return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }
    if (rows.length === 0) return res.status(404).json({ mensagem: 'Transação não encontrada.' });

    const t = rows[0];
    const participantes = [Number(t.id_comprador), Number(t.id_vendedor)];

    if (t.status !== 'concluida') {
      return res.status(400).json({ mensagem: 'Só é possível avaliar transações concluídas.' });
    }
    if (!participantes.includes(Number(id_avaliador)) || !participantes.includes(Number(id_avaliado))) {
      return res.status(403).json({ mensagem: 'Avaliador e avaliado precisam participar da transação.' });
    }

    db.query(
      'SELECT 1 FROM avaliacao WHERE id_transacao = ? AND id_avaliador = ?',
      [id_transacao, id_avaliador],
      (err, dup) => {
        if (err) {
          console.error('Erro ao verificar avaliação:', err);
          return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
        }
        if (dup.length > 0) {
          return res.status(409).json({ mensagem: 'Você já avaliou esta transação.' });
        }

        const insert = 'INSERT INTO avaliacao (id_transacao, id_avaliador, id_avaliado, nota, comentario) VALUES (?, ?, ?, ?, ?)';
        db.query(insert, [id_transacao, id_avaliador, id_avaliado, nota, comentario || null], (err) => {
          if (err) {
            console.error('Erro ao salvar avaliação:', err);
            return res.status(500).json({ mensagem: 'Erro ao processar avaliação.' });
          }
          res.status(201).json({ mensagem: 'Avaliação salva com sucesso!' });
        });
      }
    );
  });
});

app.get('/usuarios/:id/avaliacoes', (req, res) => {
  const userId = req.params.id;
  
  const query = `
    SELECT a.*, u.usuario_nome AS avaliador_nome 
    FROM avaliacao a 
    JOIN usuario u ON a.id_avaliador = u.id_usuario 
    WHERE a.id_avaliado = ?
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erro ao buscar avaliações do utilizador:', err);
      return res.status(500).json({ mensagem: 'Erro no servidor' });
    }
    res.json(results);
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

    // Comprador escrevendo -> destinatário é sempre o vendedor do anúncio.
    // Vendedor respondendo -> precisa dizer qual comprador (vem do app).
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
      res.status(201).json({ mensagem: 'Mensagem salva com sucesso', id: results.insertId });
    });
  });
});

// Lista as conversas do usuário (uma por anúncio + pessoa)
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

// Cria a proposta e já coloca um cartão dela no chat
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
    // Um dos dois precisa ser o dono do anúncio
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

// Aceitar ou recusar. Aceitar cria a transação.
app.put('/propostas/:id/responder', (req, res) => {
  const { id } = req.params;
  const { id_usuario, aceitar } = req.body;

  if (!id_usuario || typeof aceitar !== 'boolean') {
    return res.status(400).json({ mensagem: 'id_usuario e aceitar são obrigatórios.' });
  }

  const novoStatus = aceitar ? 'aceita' : 'recusada';

  // Só o destinatário responde, e só uma vez
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

// Lista as transações em que o usuário é comprador ou vendedor
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

// Concluir ou cancelar (só quem participa, e só se ainda estiver em andamento)
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

app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 3000');
});