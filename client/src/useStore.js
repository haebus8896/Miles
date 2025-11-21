import { create } from 'zustand';

const defaultAddressForm = {
  official_address: '',
  landmark: '',
  locality: '',
  city: '',
  postal_code: '',
  floor_no: 0,
  flat_no: '',
  instructions: '',
  owner_full_name: '',
  owner_phone: '',
  tags: ''
};

const defaultProfileForm = {
  full_name: '',
  phone: '',
  relation: 'primary',
  otp_reference: '',
  otp_code: ''
};

export const useStore = create((set) => ({
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),

  nearestRoad: null,
  setNearestRoad: (r) => set({ nearestRoad: r }),

  selectedRoadPoint: null,
  setSelectedRoadPoint: (p) => set({ selectedRoadPoint: p }),

  polyline: [],
  setPolyline: (updater) =>
    set((state) => ({
      polyline: typeof updater === 'function' ? updater(state.polyline) : updater
    })),

  drawing: false,
  setDrawing: (value) =>
    set((state) => ({
      drawing: typeof value === 'function' ? value(state.drawing) : value
    })),

  nearbyAddresses: [],
  setNearbyAddresses: (arr) => set({ nearbyAddresses: arr }),

  duplicates: [],
  setDuplicates: (arr) => set({ duplicates: arr }),

  addressForm: defaultAddressForm,
  setAddressField: (field, value) =>
    set((state) => ({
      addressForm: { ...state.addressForm, [field]: value }
    })),
  resetAddressForm: () => set({ addressForm: defaultAddressForm }),

  savedAddress: null,
  setSavedAddress: (address) => set({ savedAddress: address }),

  profileForm: defaultProfileForm,
  setProfileField: (field, value) =>
    set((state) => ({
      profileForm: { ...state.profileForm, [field]: value }
    })),
  resetProfileForm: () => set({ profileForm: defaultProfileForm }),

  profiles: [],
  setProfiles: (profiles) => set({ profiles }),

  otpCountdown: 0,
  setOtpCountdown: (value) =>
    set((state) => ({
      otpCountdown: typeof value === 'function' ? value(state.otpCountdown) : value
    })),

  deliverySessionId: null,
  setDeliverySessionId: (id) => set({ deliverySessionId: id }),

  deliverySummary: null,
  setDeliverySummary: (summary) => set({ deliverySummary: summary }),

  resetRoute: () => set({ polyline: [], selectedRoadPoint: null, nearestRoad: null }),

  focusPoint: null,
  setFocusPoint: (point) => set({ focusPoint: point })
}));