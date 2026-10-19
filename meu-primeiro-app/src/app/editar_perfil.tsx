import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE_URL, resolveProfileImageUrl } from '../config/api';

interface Usuario {
  id_usuario: number;
  usuario_nome: string;
  email: string;
  tipo: string;
  cpf_cnpj?: string | null;
  foto_perfil?: string | null;
  data_cadastro?: string;
}

const TIPOS_CONTA = [
  { valor: 'catador', rotulo: 'Catador', icone: 'recycle' },
  { valor: 'cooperativa', rotulo: 'Cooperativa', icone: 'account-group-outline' },
  { valor: 'industria', rotulo: 'Indústria', icone: 'factory' },
  { valor: 'empresa', rotulo: 'Empresa', icone: 'domain' },
  { valor: 'consumidor', rotulo: 'Consumidor', icone: 'cart-outline' },
];
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

export default function EditarPerfilScreen() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarUsuario();
  }, []);

  const carregarUsuario = async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
      if (!dadosSalvos) {
        router.replace('/');
        return;
      }

      const usuarioLocal: Usuario = JSON.parse(dadosSalvos);
      setUsuario(usuarioLocal);
      setNome(usuarioLocal.usuario_nome || '');
      setTipo(usuarioLocal.tipo || '');
      setFotoPerfil(resolveProfileImageUrl(usuarioLocal.foto_perfil));

      const response = await fetch(`${API_BASE_URL}/usuario/${usuarioLocal.id_usuario}`);
      const dados: Usuario & { mensagem?: string } = await response.json();
      if (!response.ok) {
        throw new Error(dados.mensagem || 'Não foi possível carregar os dados do perfil.');
      }

      setUsuario(dados);
      setNome(dados.usuario_nome || '');
      setTipo(dados.tipo || '');
      const usuarioComFotoResolvida = {
        ...dados,
        foto_perfil: resolveProfileImageUrl(dados.foto_perfil),
      };
      setFotoPerfil(usuarioComFotoResolvida.foto_perfil);
      await AsyncStorage.setItem('@usuario_logado', JSON.stringify(usuarioComFotoResolvida));
    } catch (error) {
      console.error('Erro ao carregar dados para edição do perfil:', error);
      exibirMensagem(
        'Não foi possível atualizar os dados do perfil. Você ainda pode editar os dados salvos neste dispositivo.',
        'Erro ao carregar perfil'
      );
    } finally {
      setCarregando(false);
    }
  };

  const exibirMensagem = (mensagem: string, titulo: string) => {
    if (Platform.OS === 'web') {
      alert(`${titulo}\n\n${mensagem}`);
    } else {
      Alert.alert(titulo, mensagem);
    }
  };

  const handleVoltar = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  const selecionarFoto = async () => {
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        exibirMensagem('Permita o acesso à galeria para escolher uma foto.', 'Permissão necessária');
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (resultado.canceled) return;
      const imagem = resultado.assets[0];
      if (!imagem) {
        exibirMensagem('Não foi possível carregar a imagem escolhida.', 'Erro ao escolher foto');
        return;
      }

      const imagemRedimensionada = await ImageManipulator.manipulateAsync(
        imagem.uri,
        [{ resize: { width: 512, height: 512 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (!imagemRedimensionada.base64) {
        exibirMensagem('Não foi possível processar a imagem escolhida.', 'Erro ao escolher foto');
        return;
      }

      const tamanhoImagem = Math.floor(imagemRedimensionada.base64.length * 3 / 4);
      if (tamanhoImagem > MAX_PROFILE_IMAGE_BYTES) {
        exibirMensagem('A imagem processada ultrapassou 5 MB. Escolha outra foto.', 'Imagem muito grande');
        return;
      }
      setFotoPerfil(`data:image/jpeg;base64,${imagemRedimensionada.base64}`);
    } catch (error) {
      console.error('Erro ao selecionar foto do perfil:', error);
      exibirMensagem('Não foi possível acessar a galeria de fotos.', 'Erro ao escolher foto');
    }
  };

  const handleSalvar = async () => {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      exibirMensagem('Preencha seu nome.', 'Campo obrigatório');
      return;
    }

    if (!usuario) {
      exibirMensagem('Não foi possível identificar sua conta. Entre novamente.', 'Erro');
      return;
    }

    if (
      !TIPOS_CONTA.some((opcao) => opcao.valor === tipo) &&
      !(usuario.tipo === 'admin' && tipo === 'admin')
    ) {
      exibirMensagem('Selecione um tipo de conta válido.', 'Tipo de conta inválido');
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/usuario/${usuario.id_usuario}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_nome: nomeLimpo,
          tipo,
          foto_perfil: fotoPerfil?.startsWith(`${API_BASE_URL}/uploads/`)
            ? fotoPerfil.slice(API_BASE_URL.length)
            : fotoPerfil,
        }),
      });
      const dados: { mensagem?: string; usuario?: Usuario } = await response.json();

      if (!response.ok) {
        throw new Error(dados.mensagem || 'Não foi possível salvar as alterações.');
      }

      if (!dados.usuario) {
        throw new Error('O servidor não retornou os dados atualizados do perfil.');
      }

      const usuarioAtualizado = {
        ...dados.usuario,
        foto_perfil: resolveProfileImageUrl(dados.usuario.foto_perfil),
      };
      await AsyncStorage.setItem('@usuario_logado', JSON.stringify(usuarioAtualizado));
      if (Platform.OS === 'web') {
        alert('Perfil atualizado\n\nSeus dados foram atualizados.');
        handleVoltar();
      } else {
        Alert.alert('Perfil atualizado', 'Seus dados foram atualizados.', [
          { text: 'OK', onPress: handleVoltar },
        ]);
      }
    } catch (error) {
      console.error('Erro ao salvar alterações do perfil:', error);
      const mensagem = error instanceof Error
        ? error.message
        : 'Não foi possível conectar ao servidor.';
      exibirMensagem(mensagem, 'Erro ao salvar perfil');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Carregando seus dados...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          onPress={handleVoltar}
          style={styles.backButton}
          accessibilityLabel="Voltar ao perfil"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={styles.headerSpacer} />
            <Text style={styles.topBarTitle}>Editar Perfil</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.profileCard}>
            <TouchableOpacity
              style={styles.avatarGradient}
              onPress={selecionarFoto}
              activeOpacity={0.8}
              accessibilityLabel="Alterar foto de perfil"
            >
              <View style={styles.photoPreview}>
                {fotoPerfil ? (
                  <Image source={{ uri: fotoPerfil }} style={styles.photoImage} />
                ) : (
                  <MaterialCommunityIcons name="account" size={48} color="#FFF" />
                )}
              </View>
              <View style={styles.cameraBadge}>
                <MaterialCommunityIcons name="camera" size={17} color="#FFF" />
              </View>
            </TouchableOpacity>

            <Text style={styles.userName}>{nome.trim() || 'Seu nome'}</Text>
            <Text style={styles.userEmail}>{usuario?.email || ''}</Text>

            <TouchableOpacity style={styles.photoButton} onPress={selecionarFoto} activeOpacity={0.7}>
              <MaterialCommunityIcons name="image-edit-outline" size={18} color="#2E7D32" />
              <Text style={styles.photoButtonText}>
                {fotoPerfil ? 'Alterar foto' : 'Adicionar foto'}
              </Text>
            </TouchableOpacity>
            {fotoPerfil && (
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setFotoPerfil(null)}
              >
                <Text style={styles.removePhotoText}>Remover foto</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.photoHint}>A imagem será ajustada para um formato quadrado.</Text>
          </View>

          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Informações pessoais</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Nome completo</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="account-outline"
                size={21}
                color="#78909C"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Digite seu nome"
                placeholderTextColor="#90A4AE"
                autoCapitalize="words"
                maxLength={150}
                accessibilityLabel="Nome completo"
                returnKeyType="done"
              />
            </View>

            <View style={styles.fieldHelperRow}>
              <Text style={styles.fieldHelper}>Este nome será exibido no seu perfil.</Text>
              <Text style={styles.characterCount}>{nome.length}/150</Text>
            </View>
          </View>

          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Tipo de conta</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.description}>
              Selecione a opção que melhor representa você.
            </Text>
            {usuario?.tipo === 'admin' ? (
              <View style={styles.adminNoticeContainer}>
                <MaterialCommunityIcons name="shield-account-outline" size={20} color="#546E7A" />
                <Text style={styles.adminNotice}>
                  O tipo administrador não pode ser alterado aqui.
                </Text>
              </View>
            ) : (
              <View style={styles.accountTypes}>
                {TIPOS_CONTA.map((opcao) => {
                  const selecionado = tipo === opcao.valor;
                  return (
                    <TouchableOpacity
                      key={opcao.valor}
                      style={[
                        styles.accountTypeOption,
                        selecionado && styles.accountTypeOptionSelected,
                      ]}
                      onPress={() => setTipo(opcao.valor)}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selecionado }}
                    >
                      <View
                        style={[
                          styles.accountTypeIcon,
                          selecionado && styles.accountTypeIconSelected,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={opcao.icone as keyof typeof MaterialCommunityIcons.glyphMap}
                          size={22}
                          color={selecionado ? '#2E7D32' : '#78909C'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.accountTypeText,
                          selecionado && styles.accountTypeTextSelected,
                        ]}
                      >
                        {opcao.rotulo}
                      </Text>
                      <MaterialCommunityIcons
                        name={selecionado ? 'check-circle' : 'radiobox-blank'}
                        size={21}
                        color={selecionado ? '#2E7D32' : '#B0BEC5'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, salvando && styles.saveButtonDisabled]}
            onPress={handleSalvar}
            disabled={salvando}
            activeOpacity={0.8}
          >
            {salvando ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-outline" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Salvar alterações</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#666',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 12,
  },
  backButton: {
    position: 'absolute',
    zIndex: 10,
    elevation: 10,
    top: Platform.OS === 'android' ? 40 : 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  headerSpacer: {
    width: 40,
  },
  formCard: {
    marginHorizontal: 20,
    marginTop: 0,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  description: {
    color: '#718075',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  profileCard: {
    marginHorizontal: 20,
    marginTop: 6,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    elevation: 3,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  avatarGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    elevation: 4,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#43A047',
    borderWidth: 3,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B5E20',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userName: {
    color: '#1B5E20',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  userEmail: {
    color: '#78909C',
    fontSize: 14,
    marginBottom: 12,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    backgroundColor: '#F4F9F4',
    borderRadius: 20,
  },
  photoButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
  photoHint: {
    color: '#718075',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  removePhotoButton: {
    padding: 8,
    marginTop: 4,
  },
  removePhotoText: {
    color: '#D32F2F',
    fontSize: 13,
  },
  sectionTitleContainer: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 9,
  },
  sectionTitle: {
    color: '#1B5E20',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  label: {
    color: '#263238',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 9,
  },
  inputContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E8E1',
    backgroundColor: '#F9FBF9',
    paddingHorizontal: 13,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingVertical: 10,
    color: '#263238',
    fontSize: 15,
  },
  fieldHelperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  fieldHelper: {
    color: '#718075',
    fontSize: 12,
  },
  characterCount: {
    color: '#718075',
    fontSize: 12,
  },
  accountTypes: {
    gap: 8,
  },
  accountTypeOption: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E0E8E1',
    backgroundColor: '#F9FBF9',
  },
  accountTypeOptionSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  accountTypeIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
  },
  accountTypeIconSelected: {
    backgroundColor: '#C8E6C9',
  },
  accountTypeText: {
    flex: 1,
    color: '#263238',
    fontSize: 14,
  },
  accountTypeTextSelected: {
    color: '#1B5E20',
    fontWeight: '700',
  },
  adminNotice: {
    color: '#718075',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  adminNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F4F9F4',
  },
  saveButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
