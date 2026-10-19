import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export default function AvaliacaoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id_transacao?: string; id_avaliado?: string; nome?: string }>();

  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(false);
  const [idAvaliador, setIdAvaliador] = useState<number | null>(null);
  const [nomeAvaliado, setNomeAvaliado] = useState(params.nome || '');

  const idTransacao = Number(params.id_transacao);
  const idAvaliado = Number(params.id_avaliado);

  const avisar = (titulo: string, msg: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${titulo}\n${msg}`);
      onOk?.();
    } else {
      Alert.alert(titulo, msg, [{ text: 'OK', onPress: onOk }]);
    }
  };

  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.push('/transacoes');
  };

  // Usuário logado
  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
        if (!dadosSalvos) {
          router.replace('/');
          return;
        }
        const usuario = JSON.parse(dadosSalvos) as { id_usuario?: number };
        setIdAvaliador(usuario.id_usuario || null);
      } catch (error) {
        console.error('Erro ao identificar usuário para avaliação:', error);
      }
    };
    carregarUsuario();
  }, [router]);

  // Buscar nome de quem está sendo avaliado se não vier nos parâmetros
  useEffect(() => {
    if (!idAvaliado || params.nome) return;
    const carregarNome = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/usuario/${idAvaliado}`);
        if (r.ok) {
          const u = await r.json();
          setNomeAvaliado(u.usuario_nome);
        }
      } catch (e) {
        console.error('Erro ao carregar usuário avaliado:', e);
      }
    };
    carregarNome();
  }, [idAvaliado, params.nome]);

  const handleAvaliar = async () => {
    if (nota === 0) {
      avisar('Atenção', 'Por favor, selecione uma nota de 1 a 5 estrelas.');
      return;
    }
    if (!idAvaliador || !Number.isInteger(idTransacao) || !Number.isInteger(idAvaliado) || idTransacao <= 0 || idAvaliado <= 0) {
      avisar('Erro', 'Esta transação não está disponível para avaliação ou os dados são inválidos.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/avaliacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_transacao: idTransacao,
          id_avaliador: idAvaliador,
          id_avaliado: idAvaliado,
          nota: nota,
          comentario: comentario.trim(),
        }),
      });

      const resp = await response.json();

      if (response.ok) {
        const voltarParaAvaliacoes = () => router.replace('/minhas_avaliacoes');
        if (Platform.OS === 'web') {
          window.alert('Sucesso!\nA sua avaliação foi enviada com sucesso.');
          voltarParaAvaliacoes();
        } else {
          Alert.alert('Sucesso!', 'A sua avaliação foi enviada com sucesso.', [
            { 
              text: 'OK', 
              onPress: voltarParaAvaliacoes
            }
          ]);
        }
      } else {
        throw new Error(resp.mensagem || 'Falha ao enviar avaliação.');
      }
    } catch (error) {
      console.error(error);
      const mensagem = error instanceof Error ? error.message : 'Não foi possível enviar a avaliação.';
      avisar('Erro', mensagem);
    } finally {
      setLoading(false);
    }
  };

  // Renderiza as 5 estrelas interativas
  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setNota(star)}>
            <MaterialCommunityIcons
              name={star <= nota ? "star" : "star-outline"}
              size={48}
              color={star <= nota ? "#FFD700" : "#C8E6C9"}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableOpacity style={styles.backButton} onPress={voltar}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="account-star" size={50} color="#2E7D32" />
            </View>
            <Text style={styles.title}>Avaliar Transação</Text>
            <Text style={styles.subtitle}>
              Como foi sua experiência com {nomeAvaliado || 'esta pessoa'}?
            </Text>
          </View>

          {renderStars()}
          <Text style={styles.ratingText}>
            {nota > 0 ? `${nota} estrela${nota > 1 ? 's' : ''}` : 'Toque para avaliar'}
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Deixe um comentário (opcional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Ótimo atendimento, material de qualidade..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={comentario}
              onChangeText={setComentario}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, (nota === 0 || loading) && styles.buttonDisabled]}
            onPress={handleAvaliar}
            disabled={loading || nota === 0 || !idAvaliador}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Enviar Avaliação</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  container: {
    flex: 1,
  },
  backButton: {
    padding: 20,
    marginTop: 10,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  subtitle: {
    fontSize: 16,
    color: '#558B2F',
    marginTop: 8,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginBottom: 30,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
    color: '#333',
  },
  button: {
    backgroundColor: '#2E7D32',
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  buttonDisabled: {
    backgroundColor: '#A5D6A7',
    elevation: 0,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});