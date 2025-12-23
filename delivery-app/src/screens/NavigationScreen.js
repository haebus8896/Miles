import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking, Alert, Platform } from 'react-native';
import { getAddressByCode, createDeliverySession, completeDeliverySession } from '../api';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = 'AIzaSyB0DhhGqNgBr2NSygcURNHdWWcyyKWdqlA';

// --- Geometry Helpers ---
const getDistance = (p1, p2) => {
    const R = 6371e3;
    const φ1 = p1.latitude * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.latitude) * Math.PI / 180;
    const Δλ = (p2.lng - p1.longitude) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const getClosestPointOnSegment = (p, a, b) => {
    const atob = { x: b.lng - a.lng, y: b.lat - a.lat };
    const atop = { x: p.longitude - a.lng, y: p.latitude - a.lat };
    const len = atob.x * atob.x + atob.y * atob.y;
    let dot = atop.x * atob.x + atop.y * atob.y;
    const t = Math.min(1, Math.max(0, dot / len));
    return {
        lat: a.lat + atob.y * t,
        lng: a.lng + atob.x * t
    };
};

const getBearing = (start, end) => {
    const startLat = start.lat * Math.PI / 180;
    const startLng = start.lng * Math.PI / 180;
    const endLat = end.lat * Math.PI / 180;
    const endLng = end.lng * Math.PI / 180;
    const y = Math.sin(endLng - startLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360;
};

const snapToPolyline = (userLoc, polyline) => {
    if (!polyline || polyline.length < 2) return null;
    let minDst = Infinity;
    let bestPoint = null;
    let bestIndex = 0;

    for (let i = 0; i < polyline.length - 1; i++) {
        const p1 = polyline[i];
        const p2 = polyline[i + 1];
        const closest = getClosestPointOnSegment(userLoc, p1, p2);
        const dist = getDistance(userLoc, closest); // User to Line
        if (dist < minDst) {
            minDst = dist;
            bestPoint = closest;
            bestIndex = i;
        }
    }

    // Only snap if reasonably close (e.g., 30 meters), otherwise trust GPS
    // But for "Last Mile" demo, we might want to force it more aggressively
    if (minDst > 30) return null;

    // Calculate Bearing of the segment we snapped to
    const bearing = getBearing(polyline[bestIndex], polyline[bestIndex + 1]);

    return { point: bestPoint, index: bestIndex, bearing, dist: minDst };
};

const calculateRemainingDistance = (startIndex, pointOnSegment, polyline) => {
    let dist = 0;
    // Dist from current point to end of current segment
    dist += getDistance({ latitude: pointOnSegment.lat, longitude: pointOnSegment.lng }, polyline[startIndex + 1]);

    // Add remaining segments
    for (let i = startIndex + 1; i < polyline.length - 1; i++) {
        dist += getDistance({ latitude: polyline[i].lat, longitude: polyline[i].lng }, polyline[i + 1]);
    }
    return dist;
};

export default function NavigationScreen({ address, onBack }) {
    const mapRef = useRef(null);
    const [userLocation, setUserLocation] = useState(null);
    const [heading, setHeading] = useState(0);
    const [speed, setSpeed] = useState(0);
    const [phase, setPhase] = useState(1);
    const [eta, setEta] = useState(null);
    const [distanceRemaining, setDistanceRemaining] = useState(null);
    const [isTracking, setIsTracking] = useState(false);
    const [isNavigationStarted, setIsNavigationStarted] = useState(false);
    const [routeSteps, setRouteSteps] = useState([]);
    const [currentInstruction, setCurrentInstruction] = useState('Tap Start to begin');
    const [isArrived, setIsArrived] = useState(false);

    // Analytics State
    const [sessionId, setSessionId] = useState(null);
    const [startTime, setStartTime] = useState(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.error('Permission to access location was denied');
                return;
            }

            // 1. Watch Position (GPS)
            await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 1000,
                    distanceInterval: 1, // Update more frequently for smoothness
                },
                (loc) => {
                    let effectiveLocation = loc.coords;
                    let effectiveHeading = loc.coords.heading;

                    // --- Phase 2: Custom Polyline Navigation ---
                    if (phase === 2 && address.polyline_smoothed && address.polyline_smoothed.length > 0) {
                        const snapResult = snapToPolyline(loc.coords, address.polyline_smoothed);

                        if (snapResult) {
                            // 1. Update Location to be ON the line
                            effectiveLocation = {
                                ...loc.coords,
                                latitude: snapResult.point.lat,
                                longitude: snapResult.point.lng
                            };

                            // 2. Update Heading to match road direction
                            if (snapResult.bearing) {
                                effectiveHeading = snapResult.bearing;
                                setHeading(snapResult.bearing);
                            }

                            // 3. Update Remaining Distance accurately
                            const remainingMeters = calculateRemainingDistance(snapResult.index, snapResult.point, address.polyline_smoothed);
                            setDistanceRemaining(remainingMeters / 1000); // Convert to km
                        }
                    }

                    setUserLocation(effectiveLocation);
                    setSpeed(loc.coords.speed < 0 ? 0 : loc.coords.speed * 3.6); // m/s to km/h

                    if (isNavigationStarted) {
                        updateInstruction(effectiveLocation); // Use snapped loc
                        checkAutomation(effectiveLocation);   // Use snapped loc for triggers
                    }
                }
            );

            // 2. Watch Heading (Compass)
            await Location.watchHeadingAsync((obj) => {
                setHeading(obj.trueHeading || obj.magHeading);
            });
        })();
    }, [phase, isArrived, isNavigationStarted]);

    // Initial Fit
    useEffect(() => {
        if (userLocation && mapRef.current && !isNavigationStarted) {
            const points = [
                { latitude: userLocation.latitude, longitude: userLocation.longitude },
                { latitude: address.road_point.lat, longitude: address.road_point.lng },
                { latitude: address.destination_point.lat, longitude: address.destination_point.lng }
            ];
            mapRef.current.fitToCoordinates(points, {
                edgePadding: { top: 100, right: 50, bottom: 300, left: 50 }, // More bottom padding for panel
                animated: true,
            });
        }
    }, [userLocation, isNavigationStarted]);

    // Camera Tracking
    useEffect(() => {
        if (userLocation && mapRef.current && isTracking && isNavigationStarted) {
            const isLastMile = phase === 2;
            const camera = {
                center: {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                },
                // Phase 2: Closer zoom (22), steeper pitch (70) for immersive view
                // Phase 1: Standard navigation zoom (18), standard pitch (60)
                pitch: isLastMile ? 70 : 60,
                heading: heading,
                altitude: isLastMile ? 10 : 50, // Lower altitude effectively zooms in on some map providers
                zoom: isLastMile ? 22 : 18
            };

            mapRef.current.animateCamera(camera, { duration: 500 }); // Faster updates
        }
    }, [userLocation, heading, isTracking, isNavigationStarted]);

    // Automation & Logic (Same as before)
    const checkAutomation = (coords) => {
        if (isArrived) return;
        const anchorDist = getDistance(coords, address.road_point);
        const destDist = getDistance(coords, address.destination_point);

        if (phase === 1 && anchorDist < 40) {
            setPhase(2);
            setCurrentInstruction("Arrived at Anchor. Follow green path to doorstep.");
            setIsTracking(true);
        }
        if (destDist < 15) {
            setIsArrived(true);
            setCurrentInstruction("You have arrived at the doorstep!");
            setIsTracking(false);
        }
    };



    const updateInstruction = (coords) => {
        if (!routeSteps.length || phase === 2) return;
        let nextStepIndex = -1;
        for (let i = 0; i < routeSteps.length; i++) {
            const step = routeSteps[i];
            const dist = Math.sqrt(Math.pow(step.start_location.lat - coords.latitude, 2) + Math.pow(step.start_location.lng - coords.longitude, 2));
            if (dist * 111000 < 30) { nextStepIndex = i; break; }
        }
        if (nextStepIndex !== -1) {
            setCurrentInstruction(routeSteps[nextStepIndex].html_instructions.replace(/<[^>]*>?/gm, ''));
        }
    };

    const handleDirectionsReady = (result) => {
        setEta(result.duration);
        setDistanceRemaining(result.distance);
        if (result.legs && result.legs[0] && result.legs[0].steps) {
            setRouteSteps(result.legs[0].steps);
            if (isNavigationStarted) {
                setCurrentInstruction(result.legs[0].steps[0].html_instructions.replace(/<[^>]*>?/gm, ''));
            }
        }
    };

    const startNavigation = async () => {
        setIsNavigationStarted(true);
        setIsTracking(true);
        if (phase === 2) setCurrentInstruction("Follow the green path to the doorstep.");

        // Start Analytics Session
        const start = Date.now();
        setStartTime(start);
        try {
            const res = await createDeliverySession({
                address_code: address.code,
                delivery_partner_id: "test-partner-123" // Hardcoded for demo, normally from Auth
            });
            if (res && res.sessionId) {
                setSessionId(res.sessionId);
                console.log("Analytics Session Started:", res.sessionId);
            }
        } catch (e) {
            console.warn("Failed to start analytics session", e);
        }
    };

    const handleCall = () => {
        const phone = address.owner_phone || address.owner_phone_masked;
        if (phone) Linking.openURL(`tel:${phone}`);
        else Alert.alert("No Phone", "Customer phone number not available.");
    };

    const recenter = () => setIsTracking(true);

    if (!userLocation) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Acquiring GPS...</Text>
            </View>
        );
    }

    const anchorPoint = { latitude: address.road_point.lat, longitude: address.road_point.lng };
    const destinationPoint = { latitude: address.destination_point.lat, longitude: address.destination_point.lng };
    const customPolyline = address.polyline_smoothed.map(p => ({ latitude: p.lat, longitude: p.lng }));

    return (
        <View style={styles.container}>
            {/* Map fills the entire container */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                customMapStyle={[
                    {
                        "elementType": "geometry",
                        "stylers": [{ "color": "#f5f5f5" }]
                    },
                    {
                        "elementType": "labels.icon",
                        "stylers": [{ "visibility": "off" }]
                    },
                    {
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#616161" }]
                    },
                    {
                        "elementType": "labels.text.stroke",
                        "stylers": [{ "color": "#f5f5f5" }]
                    },
                    {
                        "featureType": "administrative.land_parcel",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#bdbdbd" }]
                    },
                    {
                        "featureType": "landscape",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#E8E8E8" }] // Land/Background (Platinum)
                    },
                    {
                        "featureType": "landscape.man_made",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#D5D8DB" }] // Built-up Areas (Light Silver)
                    },
                    {
                        "featureType": "poi",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#FFF2AF" }] // Points of Interest (Banana Mania)
                    },
                    {
                        "featureType": "poi",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#757575" }]
                    },
                    {
                        "featureType": "poi.park",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#C3ECB2" }] // Green Spaces (Tea Green)
                    },
                    {
                        "featureType": "poi.park",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#9e9e9e" }]
                    },
                    {
                        "featureType": "road",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#ffffff" }]
                    },
                    {
                        "featureType": "road.arterial",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#757575" }]
                    },
                    {
                        "featureType": "road.highway",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#dadada" }]
                    },
                    {
                        "featureType": "road.highway",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#616161" }]
                    },
                    {
                        "featureType": "road.local",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#9e9e9e" }]
                    },
                    {
                        "featureType": "transit",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#F6CF65" }] // Transit (Orange-Yellow)
                    },
                    {
                        "featureType": "transit.line",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#e5e5e5" }]
                    },
                    {
                        "featureType": "transit.station",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#F6CF65" }]
                    },
                    {
                        "featureType": "water",
                        "elementType": "geometry",
                        "stylers": [{ "color": "#AADAFF" }] // Water (Fresh Air)
                    },
                    {
                        "featureType": "water",
                        "elementType": "labels.text.fill",
                        "stylers": [{ "color": "#9e9e9e" }]
                    }
                ]}
                userInterfaceStyle="light"
                onPanDrag={() => setIsTracking(false)}
            >
                <Marker coordinate={anchorPoint} title="Anchor Point" pinColor="#EA4335" />
                <Marker coordinate={destinationPoint} title="Destination" pinColor="black" />

                {/* Phase 2 Directional Arrow */}
                {phase === 2 && heading !== 0 && (
                    <Marker
                        coordinate={userLocation}
                        anchor={{ x: 0.5, y: 0.5 }}
                        rotation={heading} // Rotate arrow to match path bearing
                        flat={true} // Orient with map
                        zIndex={999}
                    >
                        <Ionicons name="arrow-up-circle" size={50} color="#34A853" />
                    </Marker>
                )}

                <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
                    <View style={styles.avatarContainer}>
                        <Ionicons name="person-circle" size={40} color="#007AFF" />
                    </View>
                </Marker>

                {phase === 1 && (
                    <MapViewDirections
                        origin={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
                        destination={anchorPoint}
                        apikey={GOOGLE_MAPS_API_KEY}
                        strokeWidth={5}
                        strokeColor="#4285F4"
                        onReady={handleDirectionsReady}
                    />
                )}

                <Polyline
                    coordinates={customPolyline}
                    strokeColor="#34A853"
                    strokeWidth={6}
                />
            </MapView>

            {/* Top Instruction Banner */}
            {isNavigationStarted && (
                <View style={[styles.instructionBanner, isArrived && styles.successBanner]}>
                    <Text style={styles.instructionText}>{currentInstruction}</Text>
                </View>
            )}

            {/* Recenter Button */}
            {isNavigationStarted && !isTracking && !isArrived && (
                <TouchableOpacity style={styles.recenterBtn} onPress={recenter}>
                    <Text style={styles.recenterText}>Re-center</Text>
                </TouchableOpacity>
            )}

            {/* Start Button (Floating above panel) */}
            {!isNavigationStarted && (
                <View style={styles.startOverlay}>
                    <TouchableOpacity style={styles.startBtn} onPress={startNavigation}>
                        <Ionicons name="navigate" size={24} color="white" style={{ marginRight: 10 }} />
                        <Text style={styles.startBtnText}>Start Navigation</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Success Overlay (Full Screen) */}
            {isArrived && (
                <View style={styles.successOverlay}>
                    <Text style={styles.successTitle}>🎉 Arrived!</Text>
                    <Text style={styles.successSub}>You are at the doorstep.</Text>
                    <TouchableOpacity style={styles.successBtn} onPress={async () => {
                        // Complete Analytics Session
                        if (sessionId && startTime) {
                            const duration = (Date.now() - startTime) / 1000;
                            await completeDeliverySession(sessionId, {
                                duration_seconds: duration,
                                distance_meters: 0 // We could track this via GPS accum if desired
                            });
                            console.log("Analytics Session Completed");
                        }
                        onBack();
                    }}>
                        <Text style={styles.successBtnText}>Complete Delivery</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Bottom Panel (Absolute Positioned) */}
            <View style={styles.panel}>
                <View style={styles.profileRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.ownerName}>{address.owner_name_masked || 'Valued Customer'}</Text>
                        <Text style={styles.addressTitle} numberOfLines={2}>{address.official_address}</Text>
                        <Text style={styles.addressSubtitle}>{address.locality}, {address.city}</Text>
                    </View>
                    <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                        <Ionicons name="call" size={24} color="#2E7D32" />
                    </TouchableOpacity>
                </View>

                {isNavigationStarted && (
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>SPEED</Text>
                            <Text style={styles.statValue}>{Math.round(speed)} km/h</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>DIST</Text>
                            <Text style={styles.statValue}>{distanceRemaining ? `${distanceRemaining.toFixed(1)} km` : '--'}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>ETA</Text>
                            <Text style={styles.statValue}>{eta ? `${Math.ceil(eta)} min` : '--'}</Text>
                        </View>
                    </View>
                )}

                <View style={styles.instructions}>
                    <Text style={styles.instructionsTitle}>Instructions:</Text>
                    <Text numberOfLines={2} style={{ color: '#555' }}>{address.instructions || 'No special instructions.'}</Text>
                </View>

                <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onBack}>
                    <Text style={[styles.buttonText, styles.secondaryButtonText]}>Exit</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        ...StyleSheet.absoluteFillObject, // Map takes full screen
    },
    panel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 10,
        zIndex: 20,
    },
    profileRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 15,
    },
    ownerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 2,
    },
    callBtn: {
        backgroundColor: '#E8F5E9',
        padding: 12,
        borderRadius: 50,
    },
    addressTitle: {
        fontSize: 14,
        color: '#555',
        marginBottom: 2,
    },
    addressSubtitle: {
        fontSize: 12,
        color: '#888',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#F5F5F5',
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 10,
        color: '#888',
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    instructions: {
        marginBottom: 15,
    },
    instructionsTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
        fontSize: 12,
        color: '#666',
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    secondaryButton: {
        backgroundColor: '#f0f0f0',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
    secondaryButtonText: {
        color: '#333',
    },
    recenterBtn: {
        position: 'absolute',
        bottom: 350, // Above the panel
        right: 20,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 30,
    },
    recenterText: {
        color: '#007AFF',
        fontWeight: 'bold',
    },
    instructionBanner: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        backgroundColor: '#333',
        padding: 15,
        borderRadius: 10,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 30,
    },
    successBanner: {
        backgroundColor: '#2E7D32',
    },
    instructionText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    successTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2E7D32',
        marginBottom: 10,
    },
    successSub: {
        fontSize: 18,
        color: '#555',
        marginBottom: 30,
    },
    successBtn: {
        backgroundColor: '#2E7D32',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
    },
    successBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    startOverlay: {
        position: 'absolute',
        bottom: 300, // Above panel
        alignSelf: 'center',
        zIndex: 30,
    },
    startBtn: {
        backgroundColor: '#007AFF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 30,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    startBtnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    avatarContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 2,
        elevation: 3,
    }
});
