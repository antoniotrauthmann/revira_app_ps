import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
 
const CATEGORIAS = [
  { label: 'Papel', icon: 'file-document-outline' },
  { label: 'Plástico', icon: 'bottle-soda-outline' },
  { label: 'Vidro', icon: 'glass-fragile' },
  { label: 'Metal', icon: 'cog-outline' },
  { label: 'Eletrônicos', icon: 'power-plug-outline' },
] as const;
 
export default function HomeScreen() {
  const router = useRouter();
 
  const handleLogout = () => {
    router.replace('/');
  };
 
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Olá, Bem-vindo(a)! 👋</Text>
          <Text style={styles.subtitle}>O que deseja fazer hoje?</Text>
        </View>
 
        {/* Impacto do mês */}
        <View style={styles.impactCard}>
          <Text style={styles.impactLabel}>Reciclado este mês</Text>
          <View style={styles.impactRow}>
            <Text style={styles.impactNumber}>12,4</Text>
            <Text style={styles.impactUnit}>kg</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '72%' }]} />
          </View>
        </View>
 
        {/* Atalhos principais */}
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push('/anuncio_listagem')}>
            <MaterialCommunityIcons name="store" size={40} color="#2E7D32" />
            <Text style={styles.cardTitle}>Anúncios</Text>
          </TouchableOpacity>
 
          <TouchableOpacity style={styles.card} activeOpacity={0.7}>
            <MaterialCommunityIcons name="truck-delivery" size={40} color="#2E7D32" />
            <Text style={styles.cardTitle}>Coletas</Text>
          </TouchableOpacity>
 
          <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push('/chat')}>
            <MaterialCommunityIcons name="message-text" size={40} color="#2E7D32" />
            <Text style={styles.cardTitle}>Mensagens</Text>
          </TouchableOpacity>
 
          <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push('/profile')}>
            <MaterialCommunityIcons name="account" size={40} color="#2E7D32" />
            <Text style={styles.cardTitle}>Meu Perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push('/anuncio_cadastro')} >
            <MaterialCommunityIcons name="plus-box" size={40} color="#2E7D32" />
            <Text style={styles.cardTitle}>Criar Anúncio</Text>
          </TouchableOpacity>
        </View>
 
        {/* Categorias de reciclagem */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categorias</Text>
 
          {CATEGORIAS.map((cat) => (
            <TouchableOpacity key={cat.label} style={styles.catRow} activeOpacity={0.7}>
              <View style={styles.catIcon}>
                <MaterialCommunityIcons name={cat.icon} size={20} color="#2E7D32" />
              </View>
              <Text style={styles.catName}>{cat.label}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#9AA69C" />
            </TouchableOpacity>
          ))}
        </View>
 
        {/* Ponto de coleta mais próximo */}
        <View style={styles.nearestCard}>
          <Text style={styles.nearestLabel}>Ponto mais próximo</Text>
          <Text style={styles.nearestName}>Ecoponto Taquaralto</Text>
          <Text style={styles.nearestAddr}>0,8 km · Papel, plástico, vidro e metal</Text>
        </View>
 
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#D32F2F" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
  scrollContainer: { padding: 24 },
  header: { marginBottom: 24, marginTop: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#1B5E20' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 4 },
 
  // Impacto
  impactCard: { marginBottom: 28 },
  impactLabel: { fontSize: 14, color: '#666', marginBottom: 6 },
  impactRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  impactNumber: { fontSize: 40, fontWeight: 'bold', color: '#1B5E20' },
  impactUnit: { fontSize: 16, fontWeight: '600', color: '#2E7D32' },
  progressTrack: {
    height: 6,
    backgroundColor: '#E0EDE1',
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 999,
  },
 
  // Atalhos
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginBottom: 28 },
  card: {
    backgroundColor: '#FFF',
    width: '47%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8F5E9',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTitle: { marginTop: 10, fontSize: 16, fontWeight: '600', color: '#2E7D32' },
 
  // Categorias
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#666', marginBottom: 8 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E9',
  },
  catIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F7EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1B241D' },
 
  // Ponto mais próximo
  nearestCard: {
    backgroundColor: '#F1F7EE',
    borderRadius: 18,
    padding: 18,
    marginBottom: 32,
  },
  nearestLabel: { fontSize: 13, fontWeight: '600', color: '#2E7D32', marginBottom: 6 },
  nearestName: { fontSize: 16, fontWeight: '600', color: '#1B241D', marginBottom: 3 },
  nearestAddr: { fontSize: 13, color: '#666' },
 
  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FFEBEE',
    gap: 8,
  },
  logoutText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 16 },
});
 