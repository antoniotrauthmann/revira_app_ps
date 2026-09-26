import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../config/api';

interface MaterialItem {
  id_material: number;
  material_nome: string;
  categoria: string;
  unidade_medida: string;
}

const CATEGORIAS = ['Papel', 'Plástico', 'Vidro', 'Metal', 'Eletrônicos', 'Outro'];
const UNIDADES = ['kg', 'g', 'ton', 'un'];

export default function CadastrarAnuncioScreen() {
  const router = useRouter();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [preco, setPreco] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);

  const [materiais, setMateriais] = useState<MaterialItem[]>([]);
  const [materialSelecionado, setMaterialSelecionado] = useState<MaterialItem | null>(null);
  const [modalMateriaisVisible, setModalMateriaisVisible] = useState(false);

  const [modalNovoMaterialVisible, setModalNovoMaterialVisible] = useState(false);
  const [novoNomeMaterial, setNovoNomeMaterial] = useState('');
  const [novaCategoria, setNovaCategoria] = useState(CATEGORIAS[0]);
  const [novaUnidade, setNovaUnidade] = useState(UNIDADES[0]);
  const [savingMaterial, setSavingMaterial] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarMateriais();
  }, []);

  const carregarMateriais = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/materiais`);
      if (response.ok) {
        const data = await response.json();
        setMateriais(data);
      }
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
    }
  };

  const selecionarImagem = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permissão necessária', 'É preciso permitir o acesso à galeria de fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImagem(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleCadastrarNovoMaterial = async () => {
    if (!novoNomeMaterial.trim()) {
      Alert.alert('Atenção', 'Informe o nome do novo material.');
      return;
    }

    setSavingMaterial(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${API_BASE_URL}/materiais`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          material_nome: novoNomeMaterial,
          categoria: novaCategoria,
          unidade_medida: novaUnidade,
        }),
      });

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error('Servidor retornou uma resposta inválida.');
      }

      if (response.ok) {
        const novoItem: MaterialItem = {
          id_material: data.id_material,
          material_nome: data.material_nome || novoNomeMaterial,
          categoria: data.categoria || novaCategoria,
          unidade_medida: data.unidade_medida || novaUnidade,
        };

        setMateriais((prev) => [...prev, novoItem]);
        setMaterialSelecionado(novoItem);
        setModalNovoMaterialVisible(false);
        setNovoNomeMaterial('');
        Alert.alert('Sucesso', 'Novo tipo de material cadastrado e selecionado!');
      } else {
        Alert.alert('Erro', data.mensagem || 'Não foi possível cadastrar o material.');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        Alert.alert('Tempo limite excedido', 'Verifique a ligação ao servidor backend.');
      } else {
        Alert.alert('Erro de Conexão', 'Não foi possível conectar ao servidor backend.');
      }
      console.error('Erro ao cadastrar material:', error);
    } finally {
      setSavingMaterial(false);
    }
  };

  const handlePublicarAnuncio = async () => {
    if (!titulo.trim() || !materialSelecionado || !quantidade || !preco) {
      Alert.alert('Campos Obrigatórios', 'Preencha o título, selecione o material, a quantidade e o preço.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/anuncios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_usuario: 1, 
          id_material: materialSelecionado.id_material,
          anuncio_titulo: titulo,
          descricao,
          quantidade: parseFloat(quantidade.replace(',', '.')),
          preco: parseFloat(preco.replace(',', '.')),
          imagem_url: imagem,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Sucesso!', 'Seu anúncio foi publicado com sucesso.', [
          { text: 'OK', onPress: () => router.push('/anuncio_listagem') }, // Rota corrigida
        ]);
      } else {
        Alert.alert('Erro', data.mensagem || 'Ocorreu um erro ao cadastrar o anúncio.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Anúncio</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Foto do Anúncio</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={selecionarImagem} activeOpacity={0.8}>
          {imagem ? (
            <Image source={{ uri: imagem }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons name="camera-plus-outline" size={36} color="#2E7D32" />
              <Text style={styles.imagePlaceholderText}>Adicionar Imagem</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Título do Anúncio *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 50kg de Papelão para Reciclagem"
          placeholderTextColor="#999"
          value={titulo}
          onChangeText={setTitulo}
        />

        <Text style={styles.label}>Tipo de Material *</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setModalMateriaisVisible(true)}
        >
          <Text style={[styles.selectButtonText, !materialSelecionado && { color: '#999' }]}>
            {materialSelecionado
              ? `${materialSelecionado.material_nome} (${materialSelecionado.categoria})`
              : 'Selecione o material'}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={22} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.newMaterialShortcut}
          onPress={() => setModalNovoMaterialVisible(true)}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#2E7D32" />
          <Text style={styles.newMaterialShortcutText}>Não encontrou seu material? Cadastre aqui</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.label}>
              Qtd ({materialSelecionado ? materialSelecionado.unidade_medida : 'kg'}) *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 15.5"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={quantidade}
              onChangeText={setQuantidade}
            />
          </View>

          <View style={styles.flex1}>
            <Text style={styles.label}>Preço (R$) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 45.00"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={preco}
              onChangeText={setPreco}
            />
          </View>
        </View>

        <Text style={styles.label}>Descrição Detalhada</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Descreva o estado do material, condições de retirada, local etc..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={descricao}
          onChangeText={setDescricao}
        />

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handlePublicarAnuncio}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Publicar Anúncio</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL SELEÇÃO */}
      <Modal visible={modalMateriaisVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione o Material</Text>
              <TouchableOpacity onPress={() => setModalMateriaisVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {materiais.map((item) => (
                <TouchableOpacity
                  key={item.id_material}
                  style={styles.materialOption}
                  onPress={() => {
                    setMaterialSelecionado(item);
                    setModalMateriaisVisible(false);
                  }}
                >
                  <View>
                    <Text style={styles.materialOptionName}>{item.material_nome}</Text>
                    <Text style={styles.materialOptionCat}>
                      {item.categoria} · {item.unidade_medida}
                    </Text>
                  </View>
                  {materialSelecionado?.id_material === item.id_material && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.addNewMaterialBtn}
              onPress={() => {
                setModalMateriaisVisible(false);
                setModalNovoMaterialVisible(true);
              }}
            >
              <MaterialCommunityIcons name="plus" size={20} color="#2E7D32" />
              <Text style={styles.addNewMaterialBtnText}>Cadastrar Outro Material</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL CADASTRO MATERIAL */}
      <Modal visible={modalNovoMaterialVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cadastrar Novo Material</Text>
              <TouchableOpacity onPress={() => setModalNovoMaterialVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Nome do Material *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Garrafa PET Transparente"
              placeholderTextColor="#999"
              value={novoNomeMaterial}
              onChangeText={setNovoNomeMaterial}
            />

            <Text style={styles.label}>Categoria *</Text>
            <View style={styles.chipGroup}>
              {CATEGORIAS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, novaCategoria === cat && styles.chipSelected]}
                  onPress={() => setNovaCategoria(cat)}
                >
                  <Text style={[styles.chipText, novaCategoria === cat && styles.chipTextSelected]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Unidade de Medida</Text>
            <View style={styles.chipGroup}>
              {UNIDADES.map((un) => (
                <TouchableOpacity
                  key={un}
                  style={[styles.chip, novaUnidade === un && styles.chipSelected]}
                  onPress={() => setNovaUnidade(un)}
                >
                  <Text style={[styles.chipText, novaUnidade === un && styles.chipTextSelected]}>
                    {un}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { marginTop: 20 }]}
              onPress={handleCadastrarNovoMaterial}
              disabled={savingMaterial}
            >
              {savingMaterial ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Salvar Material</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backButton: { padding: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#E8F5E9' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1B5E20' },
  scrollContent: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1B241D' },
  textArea: { height: 100 },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  imagePicker: { height: 140, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8F5E9', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholder: { alignItems: 'center', gap: 6 },
  imagePlaceholderText: { color: '#2E7D32', fontWeight: '500', fontSize: 13 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  selectButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  selectButtonText: { fontSize: 15, color: '#1B241D' },
  newMaterialShortcut: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
  newMaterialShortcutText: { color: '#2E7D32', fontSize: 13, fontWeight: '600' },
  submitButton: { backgroundColor: '#2E7D32', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  materialOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8F5E9' },
  materialOptionName: { fontSize: 15, fontWeight: '600', color: '#1B241D' },
  materialOptionCat: { fontSize: 12, color: '#666', marginTop: 2 },
  addNewMaterialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 12, borderWidth: 1, borderColor: '#2E7D32', borderRadius: 10 },
  addNewMaterialBtnText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 14 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F4F9F4', borderWidth: 1, borderColor: '#E8F5E9' },
  chipSelected: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextSelected: { color: '#FFF', fontWeight: 'bold' },
});