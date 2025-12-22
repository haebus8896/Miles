import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import NavigationScreen from './src/screens/NavigationScreen';

export default function App() {
  const [currentAddress, setCurrentAddress] = useState(null);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {currentAddress ? (
        <NavigationScreen
          address={currentAddress}
          onBack={() => setCurrentAddress(null)}
        />
      ) : (
        <HomeScreen onNavigate={setCurrentAddress} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
