import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

interface Coleta {
  id_coleta: number;
  data_coleta: string | null;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  anuncio_titulo: string;
  quantidade: string;
  material_nome: string;
  unidade_medida: string;
  logradouro: string | null;
  cidade: string | null;
  estado: string | null;
}

interface Transacao {
  id_transacao: number;
  anuncio_titulo: string;
  material_nome: string;
}

interface Endereco {
  id_endereco: number;
  logradouro: string | null;
  cidade: string;
  estado: string;
}

interface ToastState {
  visible: boolean;
  mensagem: string;
  tipo: 'sucesso' | 'erro' | 'alerta';
}

const NOMES_STATUS = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const CORES_STATUS = {
  agendada: '#1976D2',
  em_andamento: '#E65100',
  concluida: '#2E7D32',
  cancelada: '#D32F2F',
};

export default function ColetaScreen() {
  const router = useRouter();
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [idUsuario, setIdUsuario] = useState<number | null>(null);

  // Modal de agendamento
  const [modalVisible, setModalVisible] = useState(false);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [idTransacao, setIdTransacao] = useState<number | null>(null);
  const [idEndereco, setIdEndereco] = useState<number | null>(null);
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Cancelamento
  const [coletaParaCancelar, setColetaParaCancelar] = useState<number | null>(null);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    mensagem: '',
    tipo: 'sucesso',
  });

  useEffect(() => {
    carregarColetas();
  }, []);

  const exibirNotificacao = (mensagem: string, tipo: 'sucesso' | 'erro' | 'alerta' = 'sucesso') => {
    setToast({ visible: true, mensagem, tipo });
    setTimeout(() => {
      setToast({ visible: false, mensagem: '', tipo: 'sucesso' });
    }, 3500);
  };

  const carregarColetas = async () => {
    try {
      const dadosSalvos = await AsyncStorage.getItem('@usuario_logado');
      if (!dadosSalvos) {
        router.replace('/');
        return;
      }

      const user = JSON.parse(dadosSalvos);
      setIdUsuario(user.id_usuario);

      const response = await fetch(`${API_BASE_URL}/coletas/usuario/${user.id_usuario}`);
      if (response.ok) {
        const dados = await response.json();
        setColetas(dados);
      }
    } catch (error) {
      console.error('Erro ao carregar coletas:', error);
      exibirNotificacao('Falha ao conectar com o servidor.', 'erro');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = async () => {
    if (!idUsuario) return;

    try {
      const respT = await fetch(`${API_BASE_URL}/transacoes/usuario/${idUsuario}/disponiveis`);
      const respE = await fetch(`${API_BASE_URL}/endereco/usuario/${idUsuario}`);

      setTransacoes(await respT.json());
      setEnderecos(await respE.json());
      setIdTransacao(null);
      setIdEndereco(null);
      setData('');
      setModalVisible(true);
    } catch (error) {
      console.error('Erro ao abrir agendamento:', error);
      exibirNotificacao('Não foi possível abrir o agendamento.', 'erro');
    }
  };

  // Converte 20/12/2026 14:00 para 2026-12-20 14:00:00
  const converterData = (texto: string) => {
    const partes = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
    if (!partes) return null;
    return `${partes[3]}-${partes[2]}-${partes[1]} ${partes[4]}:${partes[5]}:00`;
  };

  const handleAgendar = async () => {
    if (!idTransacao || !idEndereco) {
      exibirNotificacao('Escolha a transação e o endereço.', 'alerta');
      return;
    }

    const dataConvertida = converterData(data);
    if (!dataConvertida) {
      exibirNotificacao('Digite a data no formato 20/12/2026 14:00.', 'alerta');
      return;
    }

    setSalvando(true);

    try {
      const response = await fetch(`${API_BASE_URL}/coletas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_transacao: idTransacao,
          id_endereco: idEndereco,
          data_coleta: dataConvertida,
        }),
      });

      const resultado = await response.json();

      if (response.ok) {
        setModalVisible(false);
        exibirNotificacao('Coleta agendada com sucesso', 'sucesso');
        carregarColetas();
      } else {
        exibirNotificacao(resultado.mensagem || 'Erro ao agendar coleta.', 'erro');
      }
    } catch (error) {
      console.error('Erro ao agendar coleta:', error);
      exibirNotificacao('Não foi possível conectar ao servidor.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const mudarStatus = async (id: number, status: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/coletas/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        exibirNotificacao('Coleta atualizada com sucesso.', 'sucesso');
        carregarColetas();
      } else {
        exibirNotificacao('Erro ao atualizar a coleta.', 'erro');
      }
    } catch (error) {
      console.error('Erro ao atualizar coleta:', error);
      exibirNotificacao('Erro de conexão ao atualizar.', 'erro');
    }
  };

  const confirmarCancelamento = async () => {
    if (!coletaParaCancelar) return;
    await mudarStatus(coletaParaCancelar, 'cancelada');
    setColetaParaCancelar(null);
  };

  const formatarData = (valor: string | null) => {
    if (!valor) return 'A definir';
    return new Date(valor).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderColetaItem = ({ item }: { item: Coleta }) => (
    <View style={styles.coletaCard}>
      <View style={styles.coletaHeader}>
        <View style={styles.coletaIconCircle}>
          <MaterialCommunityIcons name="truck-delivery-outline" size={24} color="#2E7D32" />
        </View>
        <View style={styles.coletaInfo}>
          <Text style={styles.materialText}>{item.material_nome}</Text>
          <Text style={styles.tituloText}>{item.anuncio_titulo}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: CORES_STATUS[item.status] }]}>
          <Text style={styles.statusText}>{NOMES_STATUS[item.status]}</Text>
        </View>
      </View>

      <View style={styles.detalhes}>
        <Text style={styles.detalheText}>
          Quantidade: {item.quantidade} {item.unidade_medida}
        </Text>
        <Text style={styles.detalheText}>Data: {formatarData(item.data_coleta)}</Text>
        <Text style={styles.detalheText}>
          Local: {item.logradouro ? `${item.logradouro}, ` : ''}
          {item.cidade} - {item.estado}
        </Text>
      </View>

      {item.status === 'agendada' && (
        <View style={styles.acoes}>
          <TouchableOpacity onPress={() => mudarStatus(item.id_coleta, 'em_andamento')}>
            <Text style={styles.acaoVerde}>Iniciar coleta</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setColetaParaCancelar(item.id_coleta)}>
            <Text style={styles.acaoVermelha}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'em_andamento' && (
        <View style={styles.acoes}>
          <TouchableOpacity onPress={() => mudarStatus(item.id_coleta, 'concluida')}>
            <Text style={styles.acaoVerde}>Concluir</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setColetaParaCancelar(item.id_coleta)}>
            <Text style={styles.acaoVermelha}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {toast.visible && (
        <View
          style={[
            styles.toastContainer,
            toast.tipo === 'sucesso' && styles.toastSucesso,
            toast.tipo === 'erro' && styles.toastErro,
            toast.tipo === 'alerta' && styles.toastAlerta,
          ]}
        >
          <MaterialCommunityIcons
            name={
              toast.tipo === 'sucesso'
                ? 'check-circle-outline'
                : toast.tipo === 'erro'
                ? 'alert-circle-outline'
                : 'alert-outline'
            }
            size={22}
            color="#FFF"
          />
          <Text style={styles.toastText}>{toast.mensagem}</Text>
          <TouchableOpacity onPress={() => setToast({ ...toast, visible: false })}>
            <MaterialCommunityIcons name="close" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* TopBar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Minhas Coletas</Text>
        <TouchableOpacity onPress={abrirModal} style={styles.addButtonHeader}>
          <MaterialCommunityIcons name="plus" size={24} color="#2E7D32" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>Carregando coletas...</Text>
        </View>
      ) : (
        <FlatList
          data={coletas}
          keyExtractor={(item) => item.id_coleta.toString()}
          renderItem={renderColetaItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="truck-remove-outline" size={48} color="#A5D6A7" />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma coleta agendada</Text>
              <Text style={styles.emptySubtitle}>
                Agende a retirada do material de uma compra ou venda que você já fechou.
              </Text>
              <TouchableOpacity style={styles.addFirstButton} onPress={abrirModal}>
                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                <Text style={styles.addFirstButtonText}>Agendar Coleta</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Modal de Agendamento */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalIconCircle}>
                  <MaterialCommunityIcons name="calendar-plus" size={22} color="#2E7D32" />
                </View>
                <Text style={styles.modalTitle}>Agendar Coleta</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>Transação *</Text>
              {transacoes.length === 0 && (
                <Text style={styles.avisoText}>Nenhuma transação disponível.</Text>
              )}
              {transacoes.map((t) => (
                <TouchableOpacity
                  key={t.id_transacao}
                  style={[styles.opcao, idTransacao === t.id_transacao && styles.opcaoSelecionada]}
                  onPress={() => setIdTransacao(t.id_transacao)}
                >
                  <Text style={styles.opcaoText}>
                    {t.material_nome} - {t.anuncio_titulo}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>Endereço *</Text>
              {enderecos.length === 0 && (
                <Text style={styles.avisoText}>Cadastre um endereço na tela Meus Endereços.</Text>
              )}
              {enderecos.map((e) => (
                <TouchableOpacity
                  key={e.id_endereco}
                  style={[styles.opcao, idEndereco === e.id_endereco && styles.opcaoSelecionada]}
                  onPress={() => setIdEndereco(e.id_endereco)}
                >
                  <Text style={styles.opcaoText}>
                    {e.logradouro ? `${e.logradouro}, ` : ''}
                    {e.cidade} - {e.estado}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.label}>Data e horário *</Text>
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="calendar-clock" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 20/12/2026 14:00"
                  value={data}
                  onChangeText={setData}
                  placeholderTextColor="#999"
                />
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelModalButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelModalText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveModalButton} onPress={handleAgendar} disabled={salvando}>
                {salvando ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveModalText}>Agendar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de Confirmação de Cancelamento */}
      <Modal
        visible={!!coletaParaCancelar}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setColetaParaCancelar(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.deleteIconCircle}>
              <MaterialCommunityIcons name="close-circle-outline" size={32} color="#D32F2F" />
            </View>
            <Text style={styles.confirmTitle}>Cancelar Coleta?</Text>
            <Text style={styles.confirmSubtitle}>
              A coleta será marcada como cancelada e não poderá mais ser retomada.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelConfirmButton} onPress={() => setColetaParaCancelar(null)}>
                <Text style={styles.cancelConfirmText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmButton} onPress={confirmarCancelamento}>
                <Text style={styles.deleteConfirmText}>Cancelar Coleta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },

  // Toast
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 45 : 20,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  toastSucesso: { backgroundColor: '#2E7D32' },
  toastErro: { backgroundColor: '#D32F2F' },
  toastAlerta: { backgroundColor: '#E65100' },
  toastText: { flex: 1, color: '#FFF', fontWeight: '600', fontSize: 14 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 12,
    paddingBottom: 12,
    backgroundColor: '#F4F9F4',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: '#666' },

  listContent: { padding: 20 },

  // Cards
  coletaCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  coletaHeader: { flexDirection: 'row', alignItems: 'center' },
  coletaIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coletaInfo: { flex: 1 },
  materialText: { fontSize: 15, fontWeight: 'bold', color: '#1B5E20' },
  tituloText: { fontSize: 13, color: '#558B2F', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  detalhes: { marginTop: 12, gap: 2 },
  detalheText: { fontSize: 13, color: '#666' },
  acoes: { flexDirection: 'row', gap: 20, marginTop: 14 },
  acaoVerde: { fontSize: 14, fontWeight: '600', color: '#2E7D32' },
  acaoVermelha: { fontSize: 14, fontWeight: '600', color: '#D32F2F' },

  // Lista vazia
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#78909C', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  addFirstButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  // Modal de agendamento
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1B5E20' },
  label: { fontSize: 13, fontWeight: '600', color: '#37474F', marginTop: 12, marginBottom: 6 },
  avisoText: { fontSize: 13, color: '#78909C' },
  opcao: {
    backgroundColor: '#F9FBF9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  opcaoSelecionada: { borderColor: '#2E7D32', backgroundColor: '#E8F5E9' },
  opcaoText: { fontSize: 14, color: '#263238' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FBF9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#263238' },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelModalButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CFD8DC',
  },
  cancelModalText: { color: '#607D8B', fontWeight: 'bold', fontSize: 15 },
  saveModalButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveModalText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  // Modal de confirmação
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  deleteIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: { fontSize: 18, fontWeight: 'bold', color: '#263238', marginBottom: 8 },
  confirmSubtitle: { fontSize: 14, color: '#78909C', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  confirmButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelConfirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CFD8DC',
  },
  cancelConfirmText: { color: '#607D8B', fontWeight: 'bold', fontSize: 14 },
  deleteConfirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteConfirmText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
});