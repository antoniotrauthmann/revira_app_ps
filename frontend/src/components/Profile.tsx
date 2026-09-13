import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';

export default function App() {
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [estaCarregando, setEstaCarregando] = useState(true);

  useEffect(() => {
    const buscarNomeNoBanco = async () => {
      try {
        setEstaCarregando(true);
        
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        const nomeVindoDoBanco = "Maria Silva";
        
        setNomeUsuario(nomeVindoDoBanco); 
      } catch (error) {
        console.error("Erro ao buscar o nome:", error);
      } finally {
        setEstaCarregando(false); 
      }
    };

    buscarNomeNoBanco();
  }, []);

  if (estaCarregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff9900" />
        <Text style={styles.loadingText}>Buscando dados do perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      
      {/* CABEÇALHO DO PERFIL */}
      <View style={styles.header}>
        <Image 
          source={{ uri: 'https://unsplash.com' }} 
          style={styles.avatar}
        />
        <View style={styles.headerTextContainer}>
          {}
          <Text style={styles.name}>{nomeUsuario}</Text> 
          <Text style={styles.subtitulo}>Cliente Marketplace</Text>
        </View>
      </View>

      {/* SEÇÃO DE COMPRAS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Minhas Compras</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => alert('Clicou em Pedidos')}>
          <Text style={styles.menuItemText}>🛍️  Meus Pedidos Realizados</Text>
          <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>
      </View>

      {/* SEÇÃO DE CONFIGURAÇÕES */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configurações</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => alert('Clicou em Configurações do Perfil')}>
          <Text style={styles.menuItemText}>👤  Configurações do Perfil</Text>
          <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => alert('Clicou em Configurações do App')}>
          <Text style={styles.menuItemText}>⚙️  Configurações do Aplicativo</Text>
          <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

// 5. VISUAL DA TELA (Estilos)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 60, 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitulo: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#999',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  arrow: {
    fontSize: 14,
    color: '#ccc',
  },
});