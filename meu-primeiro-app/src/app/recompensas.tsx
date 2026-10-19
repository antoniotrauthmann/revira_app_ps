import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView,
  Alert, Platform, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

export default function RecompensasScreen() {
  const router = useRouter();
  
  const [recompensas, setRecompensas] = useState<any[]>([]);
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);
  const [saldoPontos, setSaldoPontos] = useState(850); // Valor inicial padrão
  const [loading, setLoading] = useState(true);

  // Estados do Modal da Empresa
  const [modalVisible, setModalVisible] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [custo, setCusto] = useState('');
  const [qtd, setQtd] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const userJSON = await AsyncStorage.getItem('@usuario_logado');
      if (userJSON) setUsuarioLogado(JSON.parse(userJSON));

      // LER SALDO GUARDADO LOCALMENTE
      const pontosSalvos = await AsyncStorage.getItem('@saldo_pontos');
      if (pontosSalvos !== null) {
        setSaldoPontos(parseInt(pontosSalvos));
      }

      const response = await fetch(`${API_BASE_URL}/recompensas`);
      if (response.ok) {
        const data = await response.json();
        setRecompensas(data);
      }
    } catch (error) {
      console.error('Erro ao buscar recompensas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCadastrarRecompensa = async () => {
    if (!titulo || !descricao || !custo || !qtd) {
      Alert.alert('Atenção', 'Preencha todos os campos da recompensa.');
      return;
    }

    setSalvando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/recompensas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_empresa: usuarioLogado.id_usuario,
          titulo,
          descricao,
          custo_pontos: parseInt(custo),
          quantidade: parseInt(qtd),
          icone: 'star-circle',
          cor: '#F57C00'
        })
      });

      if (response.ok) {
        Alert.alert('Sucesso', 'Recompensa adicionada ao catálogo!');
        setModalVisible(false);
        setTitulo(''); setDescricao(''); setCusto(''); setQtd('');
        carregarDados();
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível cadastrar a recompensa.');
    } finally {
      setSalvando(false);
    }
  };

  const handleResgatar = async (item: any) => {
    if (saldoPontos < item.custo_pontos) {
      const msgErro = `Faltam ${item.custo_pontos - saldoPontos} pontos. Continue reciclando!`;
      if (Platform.OS === 'web') window.alert(`Pontos Insuficientes: ${msgErro}`);
      else Alert.alert('Pontos Insuficientes', msgErro);
      return;
    }

    const mensagemConfirmacao = `Deseja usar ${item.custo_pontos} pontos para resgatar: ${item.titulo}?`;

    const processarResgate = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/recompensas/resgatar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_usuario: usuarioLogado.id_usuario,
            email: usuarioLogado.email,
            id_recompensa: item.id_recompensa,
            titulo_recompensa: item.titulo
          })
        });

        const data = await response.json();

        if (response.ok) {
          // Desconta e guarda o novo saldo
          const novoSaldo = saldoPontos - item.custo_pontos;
          setSaldoPontos(novoSaldo);
          await AsyncStorage.setItem('@saldo_pontos', novoSaldo.toString());

          if (Platform.OS === 'web') {
            window.alert(`🎉 Sucesso! O cupão [${data.codigo}] foi enviado para o seu e-mail.`);
          } else {
            Alert.alert('Sucesso!', `O cupão ${data.codigo} foi enviado para o seu e-mail.`);
          }
          
          carregarDados(); // Recarrega a lista para atualizar a quantidade restante
        } else {
          if (Platform.OS === 'web') window.alert(`Atenção: ${data.mensagem}`);
          else Alert.alert('Atenção', data.mensagem);
        }
      } catch (error) {
        if (Platform.OS === 'web') window.alert('Erro de ligação ao tentar resgatar.');
        else Alert.alert('Erro', 'Não foi possível comunicar com o servidor.');
      }
    };

    if (Platform.OS === 'web') {
      const confirmar = window.confirm(mensagemConfirmacao);
      if (confirmar) processarResgate();
    } else {
      Alert.alert('Confirmar Resgate', mensagemConfirmacao, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: processarResgate }
      ]);
    }
  };

  const ehEmpresa = usuarioLogado?.tipo === 'empresa';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/home');
            }
          }} 
          style={styles.backButton}
        >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{ehEmpresa ? 'Gestão de Recompensas' : 'Minhas Recompensas'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Só mostra o saldo se não for empresa */}
        {!ehEmpresa && (
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceTitle}>Seus EcoPontos</Text>
              <MaterialCommunityIcons name="leaf-circle-outline" size={28} color="#A5D6A7" />
            </View>
            <Text style={styles.balanceAmount}>{saldoPontos} pts</Text>
          </View>
        )}

        {/* Botão de Nova Recompensa (Apenas para empresas) */}
        {ehEmpresa && (
          <TouchableOpacity style={styles.addRewardBtn} onPress={() => setModalVisible(true)}>
            <MaterialCommunityIcons name="plus-circle-outline" size={24} color="#FFF" />
            <Text style={styles.addRewardBtnText}>Adicionar Nova Recompensa</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>{ehEmpresa ? 'Recompensas da sua Empresa' : 'Catálogo Disponível'}</Text>
        
        {loading ? <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 20 }}/> : (
          recompensas.map((item) => (
            <View key={item.id_recompensa} style={styles.rewardCard}>
              <View style={[styles.rewardIconCircle, { backgroundColor: (item.cor || '#2E7D32') + '15' }]}>
                <MaterialCommunityIcons name={item.icone as any} size={28} color={item.cor || '#2E7D32'} />
              </View>
              
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardPartner}>{item.parceiro}</Text>
                <Text style={styles.rewardTitle}>{item.titulo}</Text>
                <Text style={styles.rewardDesc}>{item.descricao}</Text>
                
                <View style={styles.rewardFooter}>
                  <View style={styles.costBadge}>
                    <MaterialCommunityIcons name="star-four-points-outline" size={14} color="#F9A825" />
                    <Text style={styles.costText}>{item.custo_pontos} pts</Text>
                  </View>
                  
                  {!ehEmpresa && (
                    <TouchableOpacity 
                      style={[styles.redeemButton, saldoPontos < item.custo_pontos && styles.redeemButtonDisabled]}
                      onPress={() => handleResgatar(item)}
                    >
                      <Text style={[styles.redeemButtonText, saldoPontos < item.custo_pontos && styles.redeemTextDisabled]}>Resgatar</Text>
                    </TouchableOpacity>
                  )}
                  {ehEmpresa && (
                    <Text style={styles.qtdInfo}>Restam: {item.quantidade}</Text>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal Cadastro de Recompensa */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Recompensa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Título (Ex: 10% de desconto)</Text>
            <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} />

            <Text style={styles.label}>Descrição Detalhada</Text>
            <TextInput style={styles.input} value={descricao} onChangeText={setDescricao} multiline />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Custo (Pontos)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={custo} onChangeText={setCusto} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Quantidade Disponível</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={qtd} onChangeText={setQtd} />
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCadastrarRecompensa}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Salvar Recompensa</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 40 : 12, paddingBottom: 12, backgroundColor: '#F4F9F4' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  
  balanceCard: { backgroundColor: '#1B5E20', borderRadius: 20, padding: 24, marginBottom: 20 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceTitle: { color: '#E8F5E9', fontSize: 15, fontWeight: '600' },
  balanceAmount: { color: '#FFF', fontSize: 42, fontWeight: 'bold', marginTop: 8 },

  addRewardBtn: { flexDirection: 'row', backgroundColor: '#F57C00', padding: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 20 },
  addRewardBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B241D', marginBottom: 16 },
  rewardCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8F5E9' },
  rewardIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  rewardInfo: { flex: 1 },
  rewardPartner: { fontSize: 12, color: '#666', textTransform: 'uppercase', fontWeight: 'bold' },
  rewardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1B241D', marginTop: 2, marginBottom: 4 },
  rewardDesc: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 12 },
  rewardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFDE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FFF59D', gap: 4 },
  costText: { color: '#F57F17', fontWeight: 'bold', fontSize: 13 },
  redeemButton: { backgroundColor: '#2E7D32', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  redeemButtonDisabled: { backgroundColor: '#E0E0E0' },
  redeemButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  redeemTextDisabled: { color: '#9E9E9E' },
  qtdInfo: { fontSize: 13, color: '#F57C00', fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  label: { fontSize: 14, color: '#333', fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#C8E6C9', borderRadius: 10, padding: 12, backgroundColor: '#F9FBF9', fontSize: 15 },
  submitBtn: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});