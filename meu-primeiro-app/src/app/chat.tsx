import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, SafeAreaView, Alert, Image,
  Modal, ActivityIndicator, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { API_BASE_URL } from '../config/api';

interface Proposta {
  id: number;
  endereco: string;
  dataHora: string;
  quantidade: number;
  status: 'pendente' | 'aceita' | 'recusada';
  proponenteId: number;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  imageUrl?: string | null;
  time?: string;
  proposta?: Proposta | null;
}

interface AnuncioInfo {
  id_usuario: number;
  anuncio_titulo: string;
  preco: number;
  unidade_medida: string;
  material_nome: string;
  quantidade: number;
  status: string;
}

export default function ChatScreen() {
  const router = useRouter();
  // id_vendedor = "a outra pessoa" da conversa (para o vendedor, é o comprador)
  const { id_anuncio, id_vendedor } = useLocalSearchParams<{
    id_anuncio: string;
    id_vendedor: string;
  }>();

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState<AnuncioInfo | null>(null);

  // Comprador -> fala com o dono do anúncio. Vendedor -> fala com o comprador (param).
const idOutro = anuncio
  ? Number(userId) === Number(anuncio.id_usuario)
    ? Number(id_vendedor)
    : Number(anuncio.id_usuario)
  : NaN;

  // Formulário de proposta
  const [modalVisible, setModalVisible] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [qtd, setQtd] = useState('');
  const [enviandoProposta, setEnviandoProposta] = useState(false);

  // 1) Carrega o usuário logado
useEffect(() => {
  const carregarUsuario = async () => {
    const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
    if (dadosSalvos) setUserId(JSON.parse(dadosSalvos).id_usuario);
  };
  carregarUsuario();
}, []);

// 2) Carrega os dados do anúncio
useEffect(() => {
  if (!id_anuncio) return;

  const carregarAnuncio = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/anuncios/${id_anuncio}`);
      if (r.ok) setAnuncio(await r.json());
      else console.error('Falha ao carregar anúncio:', r.status);
    } catch (e) {
      console.error('Erro de conexão ao carregar anúncio:', e);
    }
  };
  carregarAnuncio();
}, [id_anuncio]);

// 3) Busca mensagens e atualiza a cada 5s
useEffect(() => {
  if (!userId || !anuncio || !idOutro) return;
  fetchMessages(userId);
  const timer = setInterval(() => fetchMessages(userId), 5000);
  return () => clearInterval(timer);
}, [userId, anuncio, idOutro, id_anuncio]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDataHora = (dateString: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  const fetchMessages = async (meuId: number) => {
    try {
      const url = `${API_BASE_URL}/mensagens?id_anuncio=${id_anuncio}&id_usuario=${meuId}&id_outro=${idOutro}`;
      const response = await fetch(url);
      const dados = await response.json();

      if (response.ok) {
        setMessages(
          dados.map((msg: any) => ({
            id: msg.id_mensagem.toString(),
            text: msg.conteudo,
            isUser: Number(msg.id_remetente) === Number(meuId),
            imageUrl: msg.url_imagem || null,
            time: formatTime(msg.enviado_em),
            proposta: msg.id_proposta
              ? {
                  id: msg.id_proposta,
                  endereco: msg.proposta_endereco,
                  dataHora: msg.proposta_data_hora,
                  quantidade: Number(msg.proposta_quantidade),
                  status: msg.proposta_status,
                  proponenteId: Number(msg.proposta_proponente),
                }
              : null,
          }))
        );
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      enviarMensagemParaServidor('', `data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    enviarMensagemParaServidor(inputText, null);
    setInputText('');
  };

  const enviarMensagemParaServidor = async (texto: string, imagemUrl: string | null) => {
    if (!userId || !idOutro || isNaN(idOutro)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conteudo: texto,
          id_remetente: userId,
          id_destinatario: idOutro,
          id_anuncio: Number(id_anuncio),
          url_imagem: imagemUrl,
        }),
      });
      if (response.ok) fetchMessages(userId);
      else Alert.alert('Erro', 'O servidor recusou a mensagem.');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
    }
  };

  // ---------- PROPOSTA DE ACORDO ----------

    const avisar = (titulo: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${titulo}\n${msg}`);
    else Alert.alert(titulo, msg);
  };

  const abrirFormularioProposta = () => {
    setQtd(anuncio ? String(Number(anuncio.quantidade)) : '');
    setModalVisible(true);
  };

  const enviarProposta = async () => {
    if (!userId || !idOutro || isNaN(idOutro)) {
      avisar('Erro', 'Chat ainda carregando ou aberto sem anúncio.');
      return;
    }

    const dataMatch = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const horaMatch = hora.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    const quantidade = parseFloat(qtd.replace(',', '.'));

    if (!endereco.trim() || !dataMatch || !horaMatch || !quantidade || quantidade <= 0) {
      avisar(
        'Confira os campos',
        'Preencha o endereço, a data (DD/MM/AAAA), o horário (HH:MM) e a quantidade.'
      );
      return;
    }

    const dataHora = `${dataMatch[3]}-${dataMatch[2]}-${dataMatch[1]} ${hora}:00`;

    setEnviandoProposta(true);
    try {
      const response = await fetch(`${API_BASE_URL}/propostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_anuncio: Number(id_anuncio),
          id_proponente: userId,
          id_destinatario: idOutro,
          endereco: endereco.trim(),
          data_hora: dataHora,
          quantidade,
        }),
      });
      const resp = await response.json();

      if (response.ok) {
        setModalVisible(false);
        setEndereco('');
        setData('');
        setHora('');
        fetchMessages(userId);
      } else {
        avisar('Erro', resp.mensagem || 'Não foi possível enviar a proposta.');
      }
    } catch (error) {
      avisar('Erro', 'Erro ao conectar com o servidor.');
    } finally {
      setEnviandoProposta(false);
    }
  };

  const responderProposta = async (idProposta: number, aceitar: boolean) => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/propostas/${idProposta}/responder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: userId, aceitar }),
      });
      const resp = await response.json();

      if (response.ok) {
        avisar(aceitar ? 'Acordo fechado!' : 'Proposta recusada', resp.mensagem);
      } else {
        avisar('Atenção', resp.mensagem || 'Não foi possível responder.');
      }
      fetchMessages(userId);
    } catch (error) {
      avisar('Erro', 'Erro ao conectar com o servidor.');
    }
  };

  // ---------- RENDER ----------

  const renderProposta = (item: Message) => {
    const p = item.proposta!;
    const souDestinatario = p.proponenteId !== userId;
    const corStatus =
      p.status === 'aceita' ? '#2E7D32' : p.status === 'recusada' ? '#D32F2F' : '#F57F17';
    const textoStatus =
      p.status === 'aceita' ? 'ACORDO FECHADO' : p.status === 'recusada' ? 'RECUSADA' : 'AGUARDANDO RESPOSTA';

    return (
      <View style={styles.propostaCard}>
        <View style={styles.propostaHeader}>
          <MaterialCommunityIcons name="handshake-outline" size={20} color="#1B5E20" />
          <Text style={styles.propostaTitulo}>
            {item.isUser ? 'Você propôs um acordo' : 'Proposta de acordo'}
          </Text>
        </View>

        <Text style={styles.propostaLinha}>Material: <Text style={styles.propostaValor}>{anuncio?.material_nome}</Text></Text>
        <Text style={styles.propostaLinha}>Quantidade: <Text style={styles.propostaValor}>{p.quantidade} {anuncio?.unidade_medida}</Text></Text>
        <Text style={styles.propostaLinha}>Local: <Text style={styles.propostaValor}>{p.endereco}</Text></Text>
        <Text style={styles.propostaLinha}>Quando: <Text style={styles.propostaValor}>{formatDataHora(p.dataHora)}</Text></Text>

        <Text style={[styles.propostaStatus, { color: corStatus }]}>{textoStatus}</Text>

        {p.status === 'pendente' && souDestinatario && (
          <View style={styles.propostaBotoes}>
            <TouchableOpacity style={styles.btnRecusar} onPress={() => responderProposta(p.id, false)}>
              <Text style={styles.btnRecusarTexto}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnAceitar} onPress={() => responderProposta(p.id, true)}>
              <Text style={styles.btnAceitarTexto}>Aceitar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.proposta) return renderProposta(item);

    return (
      <View style={[styles.messageBubble, item.isUser ? styles.userBubble : styles.receiverBubble]}>
        {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />}
        {item.text ? (
          <Text style={[styles.messageText, item.isUser ? styles.userText : styles.receiverText]}>
            {item.text}
          </Text>
        ) : null}
        <Text style={[styles.timeText, item.isUser ? styles.userTime : styles.receiverTime]}>
          {item.time || ''}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.adHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adTitle} numberOfLines={1}>{anuncio?.anuncio_titulo || 'Carregando...'}</Text>
          {anuncio && (
            <Text style={styles.adPrice}>
              R$ {Number(anuncio.preco).toFixed(2).replace('.', ',')} · {Number(anuncio.quantidade)} {anuncio.unidade_medida} disponíveis
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.adButton}
          onPress={() => router.push({ pathname: '/anuncio_detalhes', params: { id: id_anuncio } })}
        >
          <Text style={styles.adButtonText}>Ver Anúncio</Text>
        </TouchableOpacity>
      </View>

      {anuncio?.status === 'ativo' && (
        <TouchableOpacity style={styles.fecharAcordoBtn} onPress={abrirFormularioProposta} activeOpacity={0.8}>
          <MaterialCommunityIcons name="handshake-outline" size={20} color="#FFF" />
          <Text style={styles.fecharAcordoTexto}>Fechar acordo</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatList}
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
            <MaterialCommunityIcons name="paperclip" size={24} color="#558B2F" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Digite sua mensagem..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />

          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <MaterialCommunityIcons name="send" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL: PROPOSTA DE ACORDO */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fechar acordo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Material</Text>
              <View style={[styles.formInput, styles.formInputReadonly]}>
                <Text style={{ color: '#555' }}>{anuncio?.material_nome}</Text>
              </View>

              <Text style={styles.label}>Quantidade ({anuncio?.unidade_medida}) *</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={qtd}
                onChangeText={setQtd}
                placeholder="Ex: 15.5"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Endereço da retirada/entrega *</Text>
              <TextInput
                style={styles.formInput}
                value={endereco}
                onChangeText={setEndereco}
                placeholder="Rua, número, bairro, cidade"
                placeholderTextColor="#999"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Data *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={data}
                    onChangeText={setData}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#999"
                    keyboardType="numbers-and-punctuation"
                    maxLength={10}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Horário *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={hora}
                    onChangeText={setHora}
                    placeholder="HH:MM"
                    placeholderTextColor="#999"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={enviarProposta}
                disabled={enviandoProposta}
              >
                {enviandoProposta ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar proposta</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F9F4' },
  container: { flex: 1 },
  adHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E0E8E1', elevation: 2, gap: 12 },
  adTitle: { fontSize: 16, fontWeight: 'bold', color: '#1B5E20' },
  adPrice: { fontSize: 13, color: '#558B2F', marginTop: 2 },
  adButton: { backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  adButtonText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 12 },
  fecharAcordoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2E7D32', marginHorizontal: 16, marginTop: 10, paddingVertical: 10, borderRadius: 10 },
  fecharAcordoTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  chatList: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 10, minWidth: 80 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2E7D32', borderBottomRightRadius: 4 },
  receiverBubble: { alignSelf: 'flex-start', backgroundColor: '#E8F5E9', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#C8E6C9' },
  messageText: { fontSize: 15, marginBottom: 4 },
  userText: { color: '#FFF' },
  receiverText: { color: '#1B5E20' },
  timeText: { fontSize: 11, alignSelf: 'flex-end', marginTop: 2 },
  userTime: { color: '#A5D6A7' },
  receiverTime: { color: '#7CB342' },
  messageImage: { width: 200, height: 200, borderRadius: 8, marginBottom: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#E0E8E1' },
  attachButton: { padding: 8 },
  input: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#F9FBF9', borderWidth: 1, borderColor: '#E0E8E1', borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, marginHorizontal: 8, fontSize: 15 },
  sendButton: { backgroundColor: '#2E7D32', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  // Cartão da proposta
  propostaCard: { alignSelf: 'center', width: '90%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#C8E6C9', elevation: 2 },
  propostaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  propostaTitulo: { fontSize: 15, fontWeight: 'bold', color: '#1B5E20' },
  propostaLinha: { fontSize: 13, color: '#666', marginBottom: 4 },
  propostaValor: { color: '#1B241D', fontWeight: '600' },
  propostaStatus: { fontSize: 12, fontWeight: 'bold', marginTop: 8 },
  propostaBotoes: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btnAceitar: { flex: 1, backgroundColor: '#2E7D32', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnAceitarTexto: { color: '#FFF', fontWeight: 'bold' },
  btnRecusar: { flex: 1, borderWidth: 1, borderColor: '#D32F2F', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  btnRecusarTexto: { color: '#D32F2F', fontWeight: 'bold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  label: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginBottom: 6, marginTop: 12 },
  formInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1B241D' },
  formInputReadonly: { backgroundColor: '#F4F9F4' },
  submitButton: { backgroundColor: '#2E7D32', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});