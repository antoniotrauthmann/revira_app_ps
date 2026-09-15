const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt'); //criptografar senhas para gerar senha_hash

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
  password: '112358',      
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

app.post('/usuario', (req, res) => {
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

      // Remove o hash antes de devolver o usuário pro front
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

// --- ROTAS DE ENDEREÇO ---

// Listar endereços de um usuário
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

// Cadastrar novo endereço
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

// Deletar endereço
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
  
  // Se não houver imagem, grava como null no banco
  db.query(query, [conteudo, id_remetente, id_destinatario, url_imagem || null], (err, results) => {
    if (err) {
      console.error('Erro ao salvar mensagem:', err);
      return res.status(500).json({ mensagem: 'Erro interno ao salvar mensagem.' });
    }
    res.status(201).json({ mensagem: 'Mensagem salva com sucesso', id: results.insertId });
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

app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 3000');
});