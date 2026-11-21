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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { API_BASE_URL } from '../config/api';
import { saveSessionToken } from '../config/session';
import { colors } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [campoAtivo, setCampoAtivo] = useState<'email' | 'senha' | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const router = useRouter();

  const API_URL = `${API_BASE_URL}/usuario/login`;

  const getNomeDispositivo = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const agente = navigator.userAgent;
      const navegador = agente.includes('Edg/')
        ? 'Edge'
        : agente.includes('Firefox/')
          ? 'Firefox'
          : agente.includes('Chrome/')
            ? 'Chrome'
            : agente.includes('Safari/')
              ? 'Safari'
              : 'Navegador';
      const sistema = agente.includes('Windows')
        ? 'Windows'
        : agente.includes('Mac OS')
          ? 'macOS'
          : agente.includes('Android')
            ? 'Android'
            : agente.includes('iPhone') || agente.includes('iPad')
              ? 'iOS'
              : 'Computador';
      return `${navegador} em ${sistema}`;
    }
    return `${Device.osName || Platform.OS}${Device.modelName ? ` · ${Device.modelName}` : ''}`;
  };

  const handleLogin = async () => {
  console.log('Iniciando tentativa de login...');

  if (!email.trim() || !senha.trim()) {
    const mensagem = 'Por favor, preencha o e-mail e a senha.';
    if (Platform.OS === 'web') alert(mensagem);
    else Alert.alert('Atenção', mensagem);
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
        email: email.trim(),
        senha: senha.trim(),
        dispositivo: getNomeDispositivo(),
      }),
    });

   
    const textResponse = await response.text();
    let data;

    try {
      data = JSON.parse(textResponse);
    } catch (parseError) {
      console.error('Resposta não-JSON recebida do servidor:', textResponse);
      throw new Error('O servidor devolveu uma resposta num formato inválido.');
    }

    if (response.ok) {
      const usuarioNome = data.usuario?.usuario_nome || 'Usuário';

      if (!data.sessao?.token) {
        throw new Error('O servidor não iniciou uma sessão válida.');
      }
      await saveSessionToken(data.sessao.token);
      await AsyncStorage.setItem('@usuario_logado', JSON.stringify(data.usuario));

      if (Platform.OS === 'web') {
        alert(`Olá, ${usuarioNome}! Login realizado com sucesso.`);
        router.replace('/home');
      } else {
        Alert.alert(
          'Bem-vindo(a)!',
          `Olá, ${usuarioNome}! Login realizado com sucesso.`,
          [
            {
              text: 'Continuar',
              onPress: () => router.replace('/home'),
            },
          ]
        );
      }
    } else {
      const erroMsg = data.mensagem || 'E-mail ou senha incorretos.';
      if (Platform.OS === 'web') alert(erroMsg);
      else Alert.alert('Erro ao entrar', erroMsg);
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
    const conexaoMsg = 'Não foi possível conectar ao servidor. Verifique a ligação e o IP do backend.';
    if (Platform.OS === 'web') alert(conexaoMsg);
    else Alert.alert('Erro de Conexão', conexaoMsg);
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
        {/* Painel de marca */}
        <View style={styles.brand}>
          <View style={styles.brandRing} />
          <View style={styles.logoMark}>
            <MaterialCommunityIcons name="recycle" size={30} color={colors.signal} />
          </View>
          <Text style={styles.title}>Revira</Text>
          <Text style={styles.subtitle}>
            Compre e venda materiais recicláveis com quem está perto de você.
          </Text>
        </View>

        {/* Formulário */}
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Entrar na sua conta</Text>

          <Text style={styles.label}>E-mail</Text>
          <View style={[styles.inputContainer, campoAtivo === 'email' && styles.inputFocused]}>
            <MaterialCommunityIcons name="email-outline" size={20} color={colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="voce@email.com"
              placeholderTextColor="#8FA89A"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setCampoAtivo('email')}
              onBlur={() => setCampoAtivo(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Senha</Text>
          <View style={[styles.inputContainer, campoAtivo === 'senha' && styles.inputFocused]}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={colors.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor="#8FA89A"
              value={senha}
              onChangeText={setSenha}
              onFocus={() => setCampoAtivo('senha')}
              onBlur={() => setCampoAtivo(null)}
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setMostrarSenha((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/esqueci_senha')}
          >
            <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.signal} />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Ainda não tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/cadastro')}>
              <Text style={styles.registerBoldText}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.forest },
  scrollContainer: { flexGrow: 1 },

  brand: { paddingHorizontal: 28, paddingTop: 72, paddingBottom: 56, overflow: 'hidden' },
  brandRing: {
    position: 'absolute', right: -80, top: -60, width: 260, height: 260, borderRadius: 130,
    borderWidth: 1, borderColor: 'rgba(184,230,92,0.30)', backgroundColor: 'rgba(184,230,92,0.05)',
  },
  logoMark: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(184,230,92,0.14)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 36, fontWeight: '700', color: '#EAF5EE', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: '#B7D2C2', marginTop: 8, lineHeight: 22, maxWidth: 300 },

  sheet: {
    flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingTop: 28,
  },
  sheetTitle: { fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.4, marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 6, marginTop: 14 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, height: 52,
  },
  inputFocused: { borderColor: colors.brand, borderWidth: 2 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.ink },
  forgotPasswordButton: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 22 },
  forgotPasswordText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
  button: {
    backgroundColor: colors.forest, height: 54, borderRadius: 999,
    justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 26 },
  registerText: { color: colors.muted, fontSize: 14 },
  registerBoldText: { color: colors.brand, fontWeight: '700', fontSize: 14 },
});
