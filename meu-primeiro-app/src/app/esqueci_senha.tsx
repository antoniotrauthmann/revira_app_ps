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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '../config/api';

export default function EsqueciSenhaScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const API_URL = `${API_BASE_URL}/usuario/esqueci_senha`;

  const mostrarMensagem = (titulo, mensagem) => {
    if (Platform.OS === 'web') {
      alert(mensagem);
    } else {
      Alert.alert(titulo, mensagem);
    }
  };

  const handleEnviarCodigo = async () => {
    if (!email.trim()) {
      mostrarMensagem('Atenção', 'Informe seu e-mail.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        // Navega pra tela de código, levando o e-mail junto
        router.push({
          pathname: '/verificar_codigo',
          params: { email: email.trim() },
        });
      } else {
        mostrarMensagem('Erro', data.mensagem || 'Não foi possível enviar o código.');
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
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="lock-reset" size={60} color="#2E7D32" />
          </View>
          <Text style={styles.title}>Esqueceu a senha?</Text>
          <Text style={styles.subtitle}>Informe seu e-mail para receber um código de recuperação</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>E-mail</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Digite seu e-mail cadastrado"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleEnviarCodigo}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Enviar código</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.registerBoldText}>Voltar para o login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
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
  title: { fontSize: 26, fontWeight: 'bold', color: '#1B5E20', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#4CAF50', marginTop: 8, textAlign: 'center', paddingHorizontal: 12 },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6, marginTop: 12 },
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
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: '#333' },
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
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  registerBoldText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 14 },
});