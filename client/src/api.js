import axios from 'axios';

const BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
export const api = axios.create({ baseURL: BASE, timeout: 20000 });

export const nearestRoad = async (lat, lng) => {
  const { data } = await api.get('/api/roads/nearest', { params: { lat, lng } });
  return data?.road_point;
};

export const fetchNearbyRoads = async (lat, lng, radius = 100) => {
  const { data } = await api.get('/api/roads/nearby', { params: { lat, lng, radius } });
  return data?.roads || [];
};

export const nearbyAddresses = async (lat, lng, radius = 50) => {
  const { data } = await api.get('/api/addresses/nearby', { params: { lat, lng, radius } });
  return data?.results || [];
};

export const createAddress = async (payload) => {
  const { data } = await api.post('/api/addresses', payload);
  return data;
};

export const getAddressByCode = async (codeOrId) => {
  const { data } = await api.get(`/api/addresses/code/${codeOrId}`);
  return data?.address;
};

export const updateAddress = async (id, payload) => {
  const { data } = await api.patch(`/api/addresses/${id}`, payload);
  return data?.address;
};

export const checkDuplicates = async (lat, lng, radius = 40) => {
  const { data } = await api.get('/api/addresses/check-duplicate', { params: { lat, lng, radius } });
  return data?.results || [];
};

export const requestOtp = async (phone) => {
  const { data } = await api.post('/api/otp/request', { phone });
  return data;
};

export const verifyOtp = async (reference, otp) => {
  const { data } = await api.post('/api/otp/verify', { reference, otp });
  return data;
};

export const addProfile = async (addressId, payload) => {
  const { data } = await api.post(`/api/profiles/${addressId}`, payload);
  return data.profile;
};

export const getProfiles = async (addressId) => {
  const { data } = await api.get(`/api/profiles/${addressId}`);
  return data?.results || [];
};

export const createDeliverySession = async (payload) => {
  const { data } = await api.post('/api/delivery/sessions', payload);
  return data;
};

export const completeDeliverySession = async (sessionId, payload) => {
  const { data } = await api.patch(`/api/delivery/sessions/${sessionId}`, payload);
  return data.session;
};

export const fetchDeliverySummary = async (days = 7) => {
  const { data } = await api.get('/api/delivery/summary', { params: { days } });
  return data;
};

// --- New Residence & Auth APIs ---

export const checkApartmentName = async (query) => {
  const { data } = await api.post('/api/residence/check-apartment-name', { query });
  return data?.results || [];
};

export const getPincodeDetails = async (pincode) => {
  const { data } = await api.get(`/api/residence/pincode/${pincode}`);
  return data;
};

export const createResidence = async (payload) => {
  const { data } = await api.post('/api/residence/create', payload);
  return data;
};

export const sendAuthOtp = async (phone) => {
  const { data } = await api.post('/api/auth/send-otp', { phone });
  return data;
};

export const verifyAuthOtp = async (phone, otp) => {
  const { data } = await api.post('/api/auth/verify-otp', { phone, otp });
  return data;
};

export const addResidenceProfile = async (id, payload) => {
  const { data } = await api.post(`/api/residence/${id}/profiles`, payload);
  return data;
};

export const getResidenceByCode = async (code) => {
  const { data } = await api.get(`/api/residence/code/${code}`);
  return data;
};

export const sendEditOtp = async (id) => {
  const { data } = await api.post(`/api/residence/${id}/edit-otp`);
  return data;
};

export const verifyEditOtp = async (id, otp) => {
  const { data } = await api.post(`/api/residence/${id}/verify-edit`, { otp });
  return data;
};

export const updateResidence = async (id, payload) => {
  const { data } = await api.put(`/api/residence/${id}`, payload);
  return data;
};
