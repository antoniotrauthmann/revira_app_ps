import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // 👈 Import da navegação do Expo Router
import { API_BASE_URL } from '../config/api';

// Lista confirmada via: SHOW COLUMNS FROM usuario LIKE 'tipo';
// enum('catador','cooperativa','industria','empresa','consumidor','admin')
// ⚠️ "admin" foi propositalmente excluído: esse tipo não deve ser
// escolhível no cadastro público, apenas atribuído manualmente no banco.
const TIPOS_CONTA = [
  { label: 'Catador', value: 'catador' },
  { label: 'Cooperativa', value: 'cooperativa' },
  { label: 'Indústria', value: 'industria' },
  { label: 'Empresa', value: 'empresa' },
  { label: 'Consumidor', value: 'consumidor' },
];

export default function CadastroScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tipo, setTipo] = useState<string | null>(null);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter(); // 👈 Hook para controlar a navegação

  const API_URL = `${API_BASE_URL}/usuario/cadastro`;

  const mostrarMensagem = (titulo: string, mensagem: string) => {
    if (Platform.OS === 'web') {
      alert(mensagem);
    } else {
      Alert.alert(titulo, mensagem);
    }
  };

  const handleCadastro = async () => {
    console.log('Iniciando tentativa de cadastro...');

    if (!nome.trim() || !email.trim() || !senha.trim() || !confirmarSenha.trim()) {
      mostrarMensagem('Atenção', 'Por favor, preencha todos os campos.');
      return;
    }

    if (!tipo) {
      mostrarMensagem('Atenção', 'Selecione o tipo de conta.');
      return;
    }

    if (senha.trim().length < 6) {
      mostrarMensagem('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (senha.trim() !== confirmarSenha.trim()) {
      mostrarMensagem('Atenção', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuario_nome: nome.trim(),
          email: email.trim(),
          senha: senha.trim(),
          tipo: tipo,
        }),
      });

      const data = await response.json();
      console.log('Resposta do servidor:', data);

      if (response.ok) {
        const mensagemSucesso = 'Cadastro realizado com sucesso. Faça login para continuar.';

        if (Platform.OS === 'web') {
          alert(mensagemSucesso);
          router.replace('/');
        } else {
          Alert.alert('Sucesso!', mensagemSucesso, [
            {
              text: 'Ir para login',
              onPress: () => router.replace('/'),
            },
          ]);
        }
      } else {
        const erroMsg = data.mensagem || 'Não foi possível concluir o cadastro.';
        mostrarMensagem('Erro ao cadastrar', erroMsg);
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      mostrarMensagem(
        'Erro de Conexão',
        'Não foi possível conectar ao servidor. Verifique se o Node.js está rodando.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Logo / Cabeçalho */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="recycle" size={60} color="#2E7D32" />
          </View>
          <Text style={styles.title}>ReviraApp</Text>
          <Text style={styles.subtitle}>Crie sua conta e comece a reciclar</Text>
        </View>

        {/* Formulário */}
        <View style={styles.form}>
          <Text style={styles.label}>Nome</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="account-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Digite seu nome completo"
              placeholderTextColor="#999"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.label}>E-mail</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Digite seu e-mail"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Crie uma senha"
              placeholderTextColor="#999"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Confirmar senha</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="lock-check-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Repita a senha"
              placeholderTextColor="#999"
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Tipo de conta</Text>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setModalVisivel(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="account-group-outline" size={20} color="#666" style={styles.inputIcon} />
            <Text style={[styles.input, !tipo && styles.placeholderText]}>
              {tipo ? TIPOS_CONTA.find((t) => t.value === tipo)?.label : 'Selecione uma opção'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color="#666" />
          </TouchableOpacity>

          {/* Modal com as opções de tipo de conta */}
          <Modal
            visible={modalVisivel}
            transparent
            animationType="fade"
            onRequestClose={() => setModalVisivel(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setModalVisivel(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Selecione o tipo de conta</Text>
                <FlatList
                  data={TIPOS_CONTA}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.modalOption}
                      onPress={() => {
                        setTipo(item.value);
                        setModalVisivel(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{item.label}</Text>
                      {tipo === item.value && (
                        <MaterialCommunityIcons name="check" size={20} color="#2E7D32" />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Botão Cadastrar */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleCadastro}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Cadastrar</Text>
            )}
          </TouchableOpacity>

          {/* Rodapé / Já tem conta */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/')}>
              <Text style={styles.registerBoldText}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  subtitle: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 4,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 12,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E9',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#2E7D32',
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerBoldText: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 14,
  },
});