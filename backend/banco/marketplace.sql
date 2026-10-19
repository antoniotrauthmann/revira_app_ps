-- phpMyAdmin SQL Dump
-- version 5.2.3-2.fc44
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 17, 2026 at 11:18 PM
-- Server version: 11.8.8-MariaDB
-- PHP Version: 8.5.11

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `marketplace`
--

-- --------------------------------------------------------

--
-- Table structure for table `usuario`
--

CREATE TABLE `usuario` (
  `id_usuario` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_nome` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `senha_hash` varchar(255) NOT NULL,
  `tipo` enum('catador','cooperativa','industria','empresa','consumidor','admin') NOT NULL,
  `cpf_cnpj` varchar(20) DEFAULT NULL,
  `foto_perfil` longtext DEFAULT NULL,
  `data_cadastro` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `cpf_cnpj` (`cpf_cnpj`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `usuario`
--

INSERT INTO `usuario` (`id_usuario`, `usuario_nome`, `email`, `senha_hash`, `tipo`, `cpf_cnpj`, `foto_perfil`, `data_cadastro`) VALUES
(1, 'joao igor', 'joaozinho123@gmail.com', '$2b$10$LeHy0HIPJf6gWTfM9LR3cO4qqCHf5WFv5W/yh3KwKL0Cr23lh/Kl6', 'catador', NULL, NULL, '2026-09-14 19:56:51'),
(2, 'lionel messi', 'leomessi@gmail.com', '$2b$10$TupqA144IsSMKxm1KjU54O/RQQxiEaRTSPCM1p.lxkc7liwwgxP8O', 'catador', NULL, NULL, '2026-09-14 20:05:18'),
(3, 'arrascaeta', 'arrasca123@gmail.com', '$2b$10$HZoGFgojbb9bqD5LtBeEnuPaLub4bcXlfq89wDV6i0dUnpO9yx3l6', 'catador', NULL, NULL, '2026-09-14 20:23:50'),
(4, 'teste', 'uboltjr@gmail.com', '$2b$10$3CP9v487SBVFdWTdTVvzL.SCkrzFDnQPOEj/bixUMxNlfJvVjTBau', 'cooperativa', NULL, NULL, '2026-09-24 15:44:00'),
(5, 'aasas', 'abc@gmail.com', '$2b$10$k2cTJi/lYwbthC2.7LxByOEv17qrjF1vooUV/2ua0l7PG4cN0BHVW', 'empresa', NULL, NULL, '2026-09-28 14:33:38'),
(6, 'comprador', 'comprador@gmail.com', '$2b$10$VfyfTyvvVLLlOWbdvf1iNejZ1uOsU830yU2txpDRsh0UPuOvI.WlC', 'consumidor', NULL, NULL, '2026-10-17 17:54:34'),
(7, 'lamine yamal', 'comprador2@gmail.com', '$2b$10$hbt3Vyv0ipeLO8LorasmleqKsdjsbU3hLQATu8x7cJRb3JiX2cZAi', 'consumidor', NULL, NULL, '2026-10-17 18:50:44');

-- --------------------------------------------------------

--
-- Table structure for table `sessao_usuario`
--

CREATE TABLE `sessao_usuario` (
  `id_sessao` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `dispositivo` varchar(120) NOT NULL,
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  `ultimo_acesso` datetime NOT NULL DEFAULT current_timestamp(),
  `expira_em` datetime NOT NULL,
  `revogado_em` datetime DEFAULT NULL,
  PRIMARY KEY (`id_sessao`),
  UNIQUE KEY `uk_sessao_token_hash` (`token_hash`),
  KEY `idx_sessao_usuario` (`id_usuario`),
  CONSTRAINT `sessao_usuario_fk` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `preferencia_notificacao`
--

CREATE TABLE `preferencia_notificacao` (
  `id_usuario` int(11) NOT NULL,
  `categoria` varchar(40) NOT NULL,
  `habilitada` tinyint(1) NOT NULL,
  `atualizado_em` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_usuario`, `categoria`),
  CONSTRAINT `preferencia_notificacao_usuario_fk` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `dispositivo_notificacao`
--

CREATE TABLE `dispositivo_notificacao` (
  `id_dispositivo` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `id_sessao` int(11) NOT NULL,
  `expo_push_token` varchar(255) NOT NULL,
  `dispositivo` varchar(120) NOT NULL,
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_dispositivo`),
  UNIQUE KEY `uk_dispositivo_push_token` (`expo_push_token`),
  UNIQUE KEY `uk_dispositivo_sessao` (`id_sessao`),
  KEY `idx_dispositivo_usuario` (`id_usuario`),
  CONSTRAINT `dispositivo_notificacao_usuario_fk` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `dispositivo_notificacao_sessao_fk` FOREIGN KEY (`id_sessao`) REFERENCES `sessao_usuario` (`id_sessao`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `endereco`
--

CREATE TABLE `endereco` (
  `id_endereco` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `logradouro` varchar(200) DEFAULT NULL,
  `cidade` varchar(100) NOT NULL,
  `estado` char(2) NOT NULL,
  `cep` varchar(10) DEFAULT NULL,
  `latitude` decimal(9,6) DEFAULT NULL,
  `longitude` decimal(9,6) DEFAULT NULL,
  PRIMARY KEY (`id_endereco`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `endereco_usuario_fk` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `endereco`
--

INSERT INTO `endereco` (`id_endereco`, `id_usuario`, `logradouro`, `cidade`, `estado`, `cep`, `latitude`, `longitude`) VALUES
(1, 1, 'quintos dos infernos', 'abaetetuba', 'PA', '80000-000', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `material`
--

CREATE TABLE `material` (
  `id_material` int(11) NOT NULL AUTO_INCREMENT,
  `material_nome` varchar(100) NOT NULL,
  `categoria` varchar(50) NOT NULL,
  `unidade_medida` varchar(10) NOT NULL DEFAULT 'kg',
  PRIMARY KEY (`id_material`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `material`
--

INSERT INTO `material` (`id_material`, `material_nome`, `categoria`, `unidade_medida`) VALUES
(1, 'teste', 'Plástico', 'kg'),
(2, 'papelão', 'Papel', 'kg'),
(3, 'vidro', 'Vidro', 'kg');

-- --------------------------------------------------------

--
-- Table structure for table `anuncio`
--

CREATE TABLE `anuncio` (
  `id_anuncio` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `id_material` int(11) NOT NULL,
  `id_endereco` int(11) DEFAULT NULL,
  `anuncio_titulo` varchar(150) NOT NULL,
  `descricao` text DEFAULT NULL,
  `quantidade` decimal(10,2) NOT NULL,
  `preco` decimal(10,2) NOT NULL,
  `condicao` varchar(50) DEFAULT NULL,
  `disponibilidade` enum('imediata','a_combinar') NOT NULL DEFAULT 'imediata',
  `status` enum('ativo','vendido','removido') NOT NULL DEFAULT 'ativo',
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_anuncio`),
  KEY `id_usuario` (`id_usuario`),
  KEY `id_material` (`id_material`),
  KEY `id_endereco` (`id_endereco`),
  CONSTRAINT `anuncio_endereco_fk` FOREIGN KEY (`id_endereco`) REFERENCES `endereco` (`id_endereco`),
  CONSTRAINT `anuncio_material_fk` FOREIGN KEY (`id_material`) REFERENCES `material` (`id_material`),
  CONSTRAINT `anuncio_usuario_fk` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `anuncio`
--

INSERT INTO `anuncio` (`id_anuncio`, `id_usuario`, `id_material`, `id_endereco`, `anuncio_titulo`, `descricao`, `quantidade`, `preco`, `condicao`, `disponibilidade`, `status`, `criado_em`) VALUES
(1, 1, 1, NULL, 'teste teste', NULL, 111.00, 111.00, NULL, 'imediata', 'ativo', '2026-10-17 16:58:17'),
(2, 1, 1, NULL, 'teste teste', 'dassdadsadasdasdad', 111.00, 111.00, NULL, 'imediata', 'ativo', '2026-10-17 16:58:31'),
(3, 1, 1, NULL, 'teste teste', 'dassdadsadasdasdad', 111.00, 111.00, NULL, 'imediata', 'ativo', '2026-10-17 16:58:31'),
(4, 1, 1, NULL, 'dfafff', 'aaaaaaa', 15.00, 45.00, NULL, 'imediata', 'ativo', '2026-10-17 17:00:46'),
(5, 1, 2, NULL, 'papelao', NULL, 2.00, 4.00, NULL, 'imediata', 'ativo', '2026-10-17 17:12:53'),
(6, 6, 3, NULL, 'vidro', NULL, 15.50, 45.00, NULL, 'imediata', 'ativo', '2026-10-17 20:05:32');

-- --------------------------------------------------------

--
-- Table structure for table `favorito`
--

CREATE TABLE `favorito` (
  `id_favorito` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `id_anuncio` int(11) NOT NULL,
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_favorito`),
  UNIQUE KEY `uq_usuario_anuncio` (`id_usuario`, `id_anuncio`),
  KEY `fk_favorito_usuario` (`id_usuario`),
  KEY `fk_favorito_anuncio` (`id_anuncio`),
  CONSTRAINT `fk_favorito_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `fk_favorito_anuncio` FOREIGN KEY (`id_anuncio`) REFERENCES `anuncio` (`id_anuncio`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `assinatura`
--

CREATE TABLE `assinatura` (
  `id_assinatura` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `id_plano` int(11) NOT NULL,
  `inicio` date NOT NULL DEFAULT current_timestamp(),
  `fim` date DEFAULT NULL,
  `status` enum('ativa','cancelada','expirada') NOT NULL DEFAULT 'ativa',
  PRIMARY KEY (`id_assinatura`),
  KEY `id_usuario` (`id_usuario`),
  KEY `id_plano` (`id_plano`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `codigo_recuperacao`
--

CREATE TABLE `codigo_recuperacao` (
  `id_codigo` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `codigo` varchar(6) NOT NULL,
  `expira_em` datetime NOT NULL,
  `usado` tinyint(1) NOT NULL DEFAULT 0,
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_codigo`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `codigo_recuperacao_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `codigo_recuperacao`
--

INSERT INTO `codigo_recuperacao` (`id_codigo`, `id_usuario`, `codigo`, `expira_em`, `usado`, `criado_em`) VALUES
(1, 1, '392523', '2026-09-24 15:58:11', 0, '2026-09-24 15:43:11'),
(2, 4, '036058', '2026-09-24 15:59:22', 0, '2026-09-24 15:44:22'),
(3, 4, '375472', '2026-09-24 16:01:52', 0, '2026-09-24 15:46:52'),
(4, 4, '038785', '2026-09-24 16:06:13', 0, '2026-09-24 15:51:13'),
(5, 4, '866958', '2026-09-24 16:07:01', 0, '2026-09-24 15:52:01'),
(6, 4, '779861', '2026-09-24 16:09:20', 0, '2026-09-24 15:54:20'),
(7, 4, '466314', '2026-09-24 16:12:38', 1, '2026-09-24 15:57:38'),
(8, 4, '887419', '2026-09-24 16:19:17', 0, '2026-09-24 16:04:17'),
(9, 4, '912456', '2026-09-28 15:14:53', 0, '2026-09-28 14:59:53'),
(10, 4, '432573', '2026-09-28 16:47:56', 0, '2026-09-28 16:32:56'),
(11, 4, '972364', '2026-09-28 16:48:03', 0, '2026-09-28 16:33:03'),
(12, 4, '428037', '2026-09-28 16:51:54', 1, '2026-09-28 16:36:54');

-- --------------------------------------------------------

--
-- Table structure for table `proposta`
--

CREATE TABLE `proposta` (
  `id_proposta` int(11) NOT NULL AUTO_INCREMENT,
  `id_anuncio` int(11) NOT NULL,
  `id_proponente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `endereco` varchar(255) NOT NULL,
  `data_hora` datetime NOT NULL,
  `quantidade` decimal(10,2) NOT NULL,
  `status` enum('pendente','aceita','recusada') NOT NULL DEFAULT 'pendente',
  `criada_em` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_proposta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `proposta`
--

INSERT INTO `proposta` (`id_proposta`, `id_anuncio`, `id_proponente`, `id_destinatario`, `endereco`, `data_hora`, `quantidade`, `status`, `criada_em`) VALUES
(1, 5, 7, 1, 'minha casa, palmas, quadra 177 sul, alameda 2', '2026-10-20 10:00:00', 2.00, 'aceita', '2026-10-17 21:54:23'),
(2, 6, 1, 6, 'rua da uft', '2026-10-20 12:00:00', 15.50, 'aceita', '2026-10-17 23:07:56'),
(3, 6, 6, 1, 'rua da uft', '2026-10-16 13:00:00', 15.50, 'aceita', '2026-10-17 23:12:14');

-- --------------------------------------------------------

--
-- Table structure for table `transacao`
--

CREATE TABLE `transacao` (
  `id_transacao` int(11) NOT NULL AUTO_INCREMENT,
  `id_anuncio` int(11) NOT NULL,
  `id_comprador` int(11) NOT NULL,
  `valor_total` decimal(10,2) NOT NULL,
  `comissao` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('pendente','confirmada','em_transporte','concluida','cancelada') NOT NULL DEFAULT 'pendente',
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  `id_proposta` int(11) DEFAULT NULL,
  `quantidade` decimal(10,2) DEFAULT NULL,
  `endereco` varchar(255) DEFAULT NULL,
  `data_hora` datetime DEFAULT NULL,
  PRIMARY KEY (`id_transacao`),
  KEY `id_anuncio` (`id_anuncio`),
  KEY `id_comprador` (`id_comprador`),
  KEY `fk_transacao_proposta` (`id_proposta`),
  CONSTRAINT `fk_transacao_proposta` FOREIGN KEY (`id_proposta`) REFERENCES `proposta` (`id_proposta`),
  CONSTRAINT `transacao_anuncio_fk` FOREIGN KEY (`id_anuncio`) REFERENCES `anuncio` (`id_anuncio`),
  CONSTRAINT `transacao_comprador_fk` FOREIGN KEY (`id_comprador`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transacao`
--

INSERT INTO `transacao` (`id_transacao`, `id_anuncio`, `id_comprador`, `valor_total`, `comissao`, `status`, `criado_em`, `id_proposta`, `quantidade`, `endereco`, `data_hora`) VALUES
(1, 5, 7, 8.00, 0.00, 'concluida', '2026-10-17 19:08:35', 1, 2.00, 'minha casa, palmas, quadra 177 sul, alameda 2', '2026-10-20 10:00:00'),
(2, 6, 1, 697.50, 0.00, 'cancelada', '2026-10-17 20:08:55', 2, 15.50, 'rua da uft', '2026-10-20 12:00:00'),
(3, 6, 1, 697.50, 0.00, 'concluida', '2026-10-17 20:12:38', 3, 15.50, 'rua da uft', '2026-10-16 13:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `avaliacao`
--

CREATE TABLE `avaliacao` (
  `id_avaliacao` int(11) NOT NULL AUTO_INCREMENT,
  `id_transacao` int(11) NOT NULL,
  `id_avaliador` int(11) NOT NULL,
  `id_avaliado` int(11) NOT NULL,
  `nota` tinyint(1) NOT NULL,
  `comentario` text DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_avaliacao`),
  UNIQUE KEY `uk_transacao_avaliador` (`id_transacao`,`id_avaliador`),
  KEY `id_avaliado` (`id_avaliado`),
  KEY `avaliacao_avaliador_fk` (`id_avaliador`),
  CONSTRAINT `avaliacao_avaliado_fk` FOREIGN KEY (`id_avaliado`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `avaliacao_avaliador_fk` FOREIGN KEY (`id_avaliador`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `avaliacao_transacao_fk` FOREIGN KEY (`id_transacao`) REFERENCES `transacao` (`id_transacao`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `avaliacao`
--

INSERT INTO `avaliacao` (`id_avaliacao`, `id_transacao`, `id_avaliador`, `id_avaliado`, `nota`, `comentario`, `criado_em`) VALUES
(3, 1, 7, 1, 5, 'teste', '2026-10-17 19:33:50'),
(4, 1, 1, 7, 4, NULL, '2026-10-17 19:40:57'),
(5, 3, 1, 6, 5, 'ok', '2026-10-17 20:12:58');

-- --------------------------------------------------------

--
-- Table structure for table `coleta`
--

CREATE TABLE `coleta` (
  `id_coleta` int(11) NOT NULL AUTO_INCREMENT,
  `id_transacao` int(11) NOT NULL,
  `id_endereco` int(11) DEFAULT NULL,
  `data_coleta` datetime DEFAULT NULL,
  `status` enum('agendada','em_andamento','concluida','cancelada') NOT NULL DEFAULT 'agendada',
  PRIMARY KEY (`id_coleta`),
  UNIQUE KEY `id_transacao` (`id_transacao`),
  KEY `id_endereco` (`id_endereco`),
  CONSTRAINT `coleta_endereco_fk` FOREIGN KEY (`id_endereco`) REFERENCES `endereco` (`id_endereco`),
  CONSTRAINT `coleta_transacao_fk` FOREIGN KEY (`id_transacao`) REFERENCES `transacao` (`id_transacao`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `denuncia`
--

CREATE TABLE `denuncia` (
  `id_denuncia` int(11) NOT NULL AUTO_INCREMENT,
  `id_denunciante` int(11) NOT NULL,
  `id_usuario_denunciado` int(11) DEFAULT NULL,
  `id_anuncio` int(11) DEFAULT NULL,
  `motivo` varchar(100) NOT NULL,
  `descricao` text DEFAULT NULL,
  `status` enum('aberta','em_analise','resolvida','arquivada') NOT NULL DEFAULT 'aberta',
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_denuncia`),
  KEY `id_denunciante` (`id_denunciante`),
  KEY `id_usuario_denunciado` (`id_usuario_denunciado`),
  KEY `id_anuncio` (`id_anuncio`),
  CONSTRAINT `denuncia_anuncio_fk` FOREIGN KEY (`id_anuncio`) REFERENCES `anuncio` (`id_anuncio`),
  CONSTRAINT `denuncia_denunciante_fk` FOREIGN KEY (`id_denunciante`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `denuncia_usuario_denunciado_fk` FOREIGN KEY (`id_usuario_denunciado`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `destaque`
--

CREATE TABLE `destaque` (
  `id_destaque` int(11) NOT NULL AUTO_INCREMENT,
  `id_anuncio` int(11) NOT NULL,
  `data_inicio` datetime NOT NULL,
  `data_fim` datetime NOT NULL,
  `valor_pago` decimal(10,2) NOT NULL,
  `impressoes` int(11) NOT NULL DEFAULT 0,
  `cliques` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_destaque`),
  KEY `id_anuncio` (`id_anuncio`),
  CONSTRAINT `destaque_anuncio_fk` FOREIGN KEY (`id_anuncio`) REFERENCES `anuncio` (`id_anuncio`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `imagens_anuncio`
--

CREATE TABLE `imagens_anuncio` (
  `id_imagem` int(11) NOT NULL AUTO_INCREMENT,
  `id_anuncio` int(11) NOT NULL,
  `anuncio_caminho_imagem` varchar(255) NOT NULL,
  `ordem` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_imagem`),
  KEY `idx_anuncio_imagem` (`id_anuncio`),
  CONSTRAINT `imagem_anuncio_fk` FOREIGN KEY (`id_anuncio`) REFERENCES `anuncio` (`id_anuncio`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `mensagem`
--

CREATE TABLE `mensagem` (
  `id_mensagem` int(11) NOT NULL AUTO_INCREMENT,
  `id_anuncio` int(11) DEFAULT NULL,
  `id_remetente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `conteudo` text NOT NULL,
  `lida` tinyint(1) NOT NULL DEFAULT 0,
  `enviado_em` datetime NOT NULL DEFAULT current_timestamp(),
  `url_imagem` varchar(500) DEFAULT NULL,
  `id_proposta` int(11) DEFAULT NULL,
  PRIMARY KEY (`id_mensagem`),
  KEY `id_anuncio` (`id_anuncio`),
  KEY `id_remetente` (`id_remetente`),
  KEY `id_destinatario` (`id_destinatario`),
  CONSTRAINT `mensagem_anuncio_fk` FOREIGN KEY (`id_anuncio`) REFERENCES `anuncio` (`id_anuncio`) ON DELETE SET NULL,
  CONSTRAINT `mensagem_destinatario_fk` FOREIGN KEY (`id_destinatario`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `mensagem_remetente_fk` FOREIGN KEY (`id_remetente`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `mensagem`
--

INSERT INTO `mensagem` (`id_mensagem`, `id_anuncio`, `id_remetente`, `id_destinatario`, `conteudo`, `lida`, `enviado_em`, `url_imagem`, `id_proposta`) VALUES
(9, 5, 6, 1, 'oi', 0, '2026-10-17 18:48:24', NULL, NULL),
(10, 5, 1, 6, 'oioi', 0, '2026-10-17 18:49:29', NULL, NULL),
(11, 5, 7, 1, 'olá', 0, '2026-10-17 18:51:11', NULL, NULL),
(12, 5, 7, 1, 'Proposta de acordo', 0, '2026-10-17 18:54:23', NULL, 1),
(13, 6, 1, 6, 'oi\n', 0, '2026-10-17 20:07:38', NULL, NULL),
(14, 6, 1, 6, 'Proposta de acordo', 0, '2026-10-17 20:07:56', NULL, 2),
(15, 6, 6, 1, 'Proposta de acordo', 0, '2026-10-17 20:12:14', NULL, 3);

-- --------------------------------------------------------

--
-- Table structure for table `notificacao`
--

CREATE TABLE `notificacao` (
  `id_notificacao` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `conteudo` varchar(255) NOT NULL,
  `lida` tinyint(1) NOT NULL DEFAULT 0,
  `criado_em` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_notificacao`),
  KEY `id_usuario` (`id_usuario`),
  CONSTRAINT `notificacao_usuario_fk` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pagamento`
--

CREATE TABLE `pagamento` (
  `id_pagamento` int(11) NOT NULL AUTO_INCREMENT,
  `id_transacao` int(11) NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `metodo` varchar(30) NOT NULL,
  `status` enum('pendente','aprovado','recusado','estornado') NOT NULL DEFAULT 'pendente',
  `pago_em` datetime DEFAULT NULL,
  PRIMARY KEY (`id_pagamento`),
  UNIQUE KEY `id_transacao` (`id_transacao`),
  CONSTRAINT `pagamento_transacao_fk` FOREIGN KEY (`id_transacao`) REFERENCES `transacao` (`id_transacao`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `plano`
--

CREATE TABLE `plano` (
  `id_plano` int(11) NOT NULL AUTO_INCREMENT,
  `plano_nome` varchar(100) NOT NULL,
  `tipo` enum('empresa','fornecedor') NOT NULL,
  `valor_mensal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_plano`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;