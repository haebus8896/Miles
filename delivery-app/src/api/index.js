import axios from 'axios';
import { Platform } from 'react-native';

// Use local IP for physical device or emulator
const BASE_URL = 'http://10.46.166.176:5001/api';

const api = axios.create({
    baseURL: BASE_URL,
});

export const getAddressByCode = async (code) => {
    try {
        const response = await api.get(`/addresses/code/${code}`);
        return response.data.address;
    } catch (error) {
        throw error;
    }
};

export const createDeliverySession = async ({ address_code, delivery_partner_id }) => {
    try {
        const response = await api.post('/delivery/sessions', {
            address_code,
            delivery_partner_id,
            mode: 'SMART_NAV'
        });
        return response.data;
    } catch (error) {
        console.error("createDeliverySession error", error);
        // Don't block flow if analytics fail
        return null;
    }
};

export const completeDeliverySession = async (sessionId, metrics) => {
    try {
        const response = await api.patch(`/delivery/sessions/${sessionId}`, { metrics });
        return response.data;
    } catch (error) {
        console.error("completeDeliverySession error", error);
        return null;
    }
};
