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

export default function VerificarCodigoScreen() {
  const { email } = useLocalSearchParams();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  const router = useRouter();

  const mostrarMensagem = (titulo, mensagem) => {
    if (Platform.OS === 'web') {
      alert(mensagem);
    } else {
      Alert.alert(titulo, mensagem);
    }
  };

  const handleVerificar = async () => {
    if (!codigo.trim() || codigo.trim().length !== 6) {
      mostrarMensagem('Atenção', 'Digite o código de 6 dígitos enviado para o seu e-mail.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/usuario/verificar_codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo: codigo.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push({
          pathname: '/nova_senha',
          params: { email, codigo: codigo.trim() },
        });
      } else {
        mostrarMensagem('Erro', data.mensagem || 'Código inválido.');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      mostrarMensagem('Erro de Conexão', 'Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    setReenviando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/usuario/esqueci_senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        mostrarMensagem('Pronto', 'Um novo código foi enviado para o seu e-mail.');
      } else {
        mostrarMensagem('Erro', data.mensagem || 'Não foi possível reenviar o código.');
      }
    } catch (error) {
      console.error('Erro ao reenviar:', error);
      mostrarMensagem('Erro de Conexão', 'Não foi possível conectar ao servidor.');
    } finally {
      setReenviando(false);
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
            <MaterialCommunityIcons name="email-check-outline" size={60} color="#2E7D32" />
          </View>
          <Text style={styles.title}>Verifique seu e-mail</Text>
          <Text style={styles.subtitle}>
            Enviamos um código de 6 dígitos para{'\n'}
            <Text style={{ fontWeight: 'bold' }}>{email}</Text>
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Código</Text>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="numeric" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.codigoInput]}
              placeholder="000000"
              placeholderTextColor="#999"
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleVerificar}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Confirmar código</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Não recebeu? </Text>
            <TouchableOpacity onPress={handleReenviar} disabled={reenviando}>
              <Text style={styles.registerBoldText}>
                {reenviando ? 'Enviando...' : 'Reenviar código'}
              </Text>
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
  codigoInput: { fontSize: 22, letterSpacing: 8, fontWeight: 'bold', textAlign: 'center' },
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
  registerText: { color: '#666', fontSize: 14 },
  registerBoldText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 14 },
});