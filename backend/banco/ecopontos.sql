SET NAMES utf8mb4;

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
  materiais set('pet','vidro','papel','latinha') NOT NULL DEFAULT '',
  status enum('operando','manutencao','lotado','inativo') NOT NULL DEFAULT 'operando',
  id_usuario_cadastro int(11) DEFAULT NULL,
  criado_em timestamp NOT NULL DEFAULT current_timestamp(),
  atualizado_em timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (id_ecoponto),
  KEY idx_ecoponto_cidade (cidade, estado),
  KEY idx_ecoponto_coordenadas (latitude, longitude),
  KEY idx_ecoponto_usuario (id_usuario_cadastro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


INSERT INTO ecoponto (nome, tipo, descricao, logradouro, bairro, cidade, estado, cep, latitude, longitude, materiais, status)
SELECT 'Ecoponto Plano Diretor Sul', 'ecoponto', 'Ponto fictício para testes', 'Quadra 1103 Sul, Av. LO-27', 'Plano Diretor Sul', 'Palmas', 'TO', '77000-000', -10.246500, -48.326200, 'pet,vidro,papel,latinha', 'operando'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ecoponto WHERE nome = 'Ecoponto Plano Diretor Sul' AND cidade = 'Palmas' AND descricao = 'Ponto fictício para testes');

INSERT INTO ecoponto (nome, tipo, descricao, logradouro, bairro, cidade, estado, cep, latitude, longitude, materiais, status)
SELECT 'Ecoponto Taquaralto', 'ecoponto', 'Ponto fictício para testes', 'Av. Tocantins', 'Taquaralto', 'Palmas', 'TO', '77000-000', -10.328500, -48.299500, 'pet,papel,latinha', 'operando'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ecoponto WHERE nome = 'Ecoponto Taquaralto' AND cidade = 'Palmas' AND descricao = 'Ponto fictício para testes');

INSERT INTO ecoponto (nome, tipo, descricao, logradouro, bairro, cidade, estado, cep, latitude, longitude, materiais, status)
SELECT 'Máquina Revira - Plano Diretor Norte', 'maquina', 'Ponto fictício para testes', 'Quadra 104 Norte, Av. JK', 'Plano Diretor Norte', 'Palmas', 'TO', '77000-000', -10.177000, -48.330500, 'pet,latinha', 'lotado'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ecoponto WHERE nome = 'Máquina Revira - Plano Diretor Norte' AND cidade = 'Palmas' AND descricao = 'Ponto fictício para testes');

INSERT INTO ecoponto (nome, tipo, descricao, logradouro, bairro, cidade, estado, cep, latitude, longitude, materiais, status)
SELECT 'Ecoponto Paraíso - Centro', 'ecoponto', 'Ponto fictício para testes', 'Av. Transbrasiliana', 'Centro', 'Paraíso do Tocantins', 'TO', '77600-000', -10.175800, -48.882600, 'pet,vidro,papel,latinha', 'operando'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ecoponto WHERE nome = 'Ecoponto Paraíso - Centro' AND cidade = 'Paraíso do Tocantins' AND descricao = 'Ponto fictício para testes');

INSERT INTO ecoponto (nome, tipo, descricao, logradouro, bairro, cidade, estado, cep, latitude, longitude, materiais, status)
SELECT 'Máquina Revira - Paraíso Setor Sul', 'maquina', 'Ponto fictício para testes', 'Rua 13', 'Setor Sul', 'Paraíso do Tocantins', 'TO', '77600-000', -10.186000, -48.876000, 'pet,vidro,latinha', 'manutencao'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM ecoponto WHERE nome = 'Máquina Revira - Paraíso Setor Sul' AND cidade = 'Paraíso do Tocantins' AND descricao = 'Ponto fictício para testes');
