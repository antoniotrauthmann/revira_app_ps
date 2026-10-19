import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Dados fictícios para a Sprint 3 (depois pode ligar ao backend)
const RECOMPENSAS_DISPONIVEIS = [
  {
    id: 1,
    parceiro: 'Supermercado Central',
    descricao: 'R$ 15,00 de desconto em compras acima de R$ 100.',
    custoPontos: 500,
    icone: 'cart-outline',
    cor: '#F57C00',
  },
  {
    id: 2,
    parceiro: 'Conta de Luz (Energisa)',
    descricao: 'Desconto de 5% na próxima fatura de energia.',
    custoPontos: 1200,
    icone: 'lightning-bolt-outline',
    cor: '#FBC02D',
  },
  {
    id: 3,
    parceiro: 'Transporte Público',
    descricao: '1 Passagem de ônibus gratuita.',
    custoPontos: 300,
    icone: 'bus-side',
    cor: '#1976D2',
  },
];

export default function RecompensasScreen() {
  const router = useRouter();
  
  // Saldo simulado do utilizador
  const [saldoPontos, setSaldoPontos] = useState(850);

  const handleResgatar = (item: typeof RECOMPENSAS_DISPONIVEIS[0]) => {
    if (saldoPontos >= item.custoPontos) {
      if (Platform.OS === 'web') {
        alert(`Sucesso! Resgatou a recompensa: ${item.parceiro}. O cupão foi enviado para o seu e-mail.`);
        setSaldoPontos(saldoPontos - item.custoPontos);
      } else {
        Alert.alert(
          'Confirmar Resgate',
          `Deseja usar ${item.custoPontos} pontos para resgatar esta recompensa de ${item.parceiro}?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Confirmar', 
              onPress: () => {
                setSaldoPontos(saldoPontos - item.custoPontos);
                Alert.alert('Sucesso!', 'O cupão foi enviado para o seu e-mail.');
              }
            }
          ]
        );
      }
    } else {
      const falta = item.custoPontos - saldoPontos;
      const msg = `Faltam ${falta} pontos para resgatar esta recompensa. Continue reciclando!`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Pontos Insuficientes', msg);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/profile' as any); 
            }
          }} 
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1B5E20" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Minhas Recompensas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Card de Saldo */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Seus EcoPontos</Text>
            <MaterialCommunityIcons name="leaf-circle-outline" size={28} color="#A5D6A7" />
          </View>
          <Text style={styles.balanceAmount}>{saldoPontos} pts</Text>
          <Text style={styles.balanceSubtitle}>Equivale a ~ R$ {(saldoPontos * 0.03).toFixed(2).replace('.', ',')} em benefícios</Text>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: '70%' }]} />
          </View>
          <Text style={styles.progressText}>Faltam 150 pts para o nível Prata</Text>
        </View>

        {/* Como ganhar pontos (Info) */}
        <View style={styles.infoSection}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#2E7D32" />
          <Text style={styles.infoText}>
            Ganhe pontos a cada kg de material reciclado vendido ou doado na plataforma.
          </Text>
        </View>

        {/* Lista de Recompensas */}
        <Text style={styles.sectionTitle}>Recompensas Disponíveis</Text>
        
        {RECOMPENSAS_DISPONIVEIS.map((item) => (
          <View key={item.id} style={styles.rewardCard}>
            <View style={[styles.rewardIconCircle, { backgroundColor: item.cor + '15' }]}>
              <MaterialCommunityIcons name={item.icone as any} size={28} color={item.cor} />
            </View>
            
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardPartner}>{item.parceiro}</Text>
              <Text style={styles.rewardDesc}>{item.descricao}</Text>
              
              <View style={styles.rewardFooter}>
                <View style={styles.costBadge}>
                  <MaterialCommunityIcons name="star-four-points-outline" size={14} color="#F9A825" />
                  <Text style={styles.costText}>{item.custoPontos} pts</Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.redeemButton, saldoPontos < item.custoPontos && styles.redeemButtonDisabled]}
                  onPress={() => handleResgatar(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.redeemButtonText, saldoPontos < item.custoPontos && styles.redeemTextDisabled]}>
                    Resgatar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F4' },
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
  topBarTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B5E20' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  
  // Balance Card
  balanceCard: {
    backgroundColor: '#1B5E20',
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 20,
  },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceTitle: { color: '#E8F5E9', fontSize: 15, fontWeight: '600' },
  balanceAmount: { color: '#FFF', fontSize: 42, fontWeight: 'bold', marginTop: 8 },
  balanceSubtitle: { color: '#A5D6A7', fontSize: 13, marginTop: 4, marginBottom: 20 },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3 },
  progressBarFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
  progressText: { color: '#E8F5E9', fontSize: 12, marginTop: 8, textAlign: 'right' },

  // Info Section
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  infoText: { flex: 1, color: '#2E7D32', fontSize: 13, lineHeight: 18 },

  // Rewards List
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1B241D', marginBottom: 16 },
  rewardCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8F5E9',
    elevation: 1,
  },
  rewardIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rewardInfo: { flex: 1 },
  rewardPartner: { fontSize: 15, fontWeight: 'bold', color: '#1B241D', marginBottom: 4 },
  rewardDesc: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 12 },
  rewardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFF59D',
    gap: 4,
  },
  costText: { color: '#F57F17', fontWeight: 'bold', fontSize: 13 },
  redeemButton: { backgroundColor: '#2E7D32', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  redeemButtonDisabled: { backgroundColor: '#E0E0E0' },
  redeemButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  redeemTextDisabled: { color: '#9E9E9E' },
});