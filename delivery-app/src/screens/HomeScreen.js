import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getAddressByCode } from '../api';

export default function HomeScreen({ onNavigate }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!code.trim()) {
            Alert.alert('Error', 'Please enter a code');
            return;
        }

        setLoading(true);
        try {
            const address = await getAddressByCode(code.trim());
            onNavigate(address);
        } catch (error) {
            const msg = error.response?.data?.error || error.message || 'Unknown error';
            Alert.alert('Error', `Failed: ${msg}`);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Delivery Partner</Text>
            <Text style={styles.subtitle}>Enter Smart Address Code</Text>

            <TextInput
                style={styles.input}
                placeholder="e.g. SLMD-8BVFXP"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
            />

            <TouchableOpacity style={styles.button} onPress={handleSearch} disabled={loading}>
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Start Navigation</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40,
        color: '#666',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 15,
        fontSize: 18,
        marginBottom: 20,
        backgroundColor: '#f9f9f9',
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
