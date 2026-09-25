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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../config/api';

export default function NovaSenhaScreen() {
  const { email, codigo } = useLocalSearchParams();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const mostrarMensagem = (titulo, mensagem) => {
    if (Platform.OS === 'web') {
      alert(mensagem);
    } else {
      Alert.alert(titulo, mensagem);
    }
  };

  const handleRedefinir = async () => {
    if (!novaSenha.trim() || !confirmarSenha.trim()) {
      mostrarMensagem('Atenção', 'Preencha os dois campos de senha.');
      return;
    }

    if (novaSenha.trim().length < 6) {
      mostrarMensagem('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha.trim() !== confirmarSenha.trim()) {
      mostrarMensagem('Atenção', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/usuario/redefinir_senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo, novaSenha: novaSenha.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        const mensagemSucesso = 'Senha redefinida com sucesso. Faça login com a nova senha.';

        if (Platform.OS === 'web') {
          alert(mensagemSucesso);
          router.replace('/');
        } else {
          Alert.alert('Sucesso!', mensagemSucesso, [
            { text: 'Ir para login', onPress: () => router.replace('/') },
          ]);
        }
      } else {
        mostrarMensagem('Erro', data.mensagem || 'Não foi possível redefinir a senha.');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      mostrarMensagem('Erro de Conexão', 'Não foi possível conectar ao servidor.');
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
            <MaterialCommunityIcons name="lock-check-outline" size={60} color="#2E7D32" />
          </View>
          <Text style={styles.title}>Nova senha</Text>
          <Text style={styles.subtitle}>Crie uma nova senha para sua conta</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nova senha</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Digite a nova senha"
              placeholderTextColor="#999"
              value={novaSenha}
              onChangeText={setNovaSenha}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Confirmar nova senha</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="lock-check-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Repita a nova senha"
              placeholderTextColor="#999"
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRedefinir}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Redefinir senha</Text>
            )}
          </TouchableOpacity>
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
  title: { fontSize: 26, fontWeight: 'bold', color: '#1B5E20' },
  subtitle: { fontSize: 14, color: '#4CAF50', marginTop: 4 },
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
});