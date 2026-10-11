import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export interface FreeMapViewRef {
  zoomIn: () => void;
  zoomOut: () => void;
  animateToRegion: (coords: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number }) => void;
}

export interface FreeMapViewProps {
  latitude: number;
  longitude: number;
  circleRadius?: number;
  interactive?: boolean;
  onLocationChange?: (coords: { latitude: number; longitude: number }) => void;
  style?: any;
  zoom?: number;
}

const FreeMapView = forwardRef<FreeMapViewRef, FreeMapViewProps>(({
  latitude,
  longitude,
  circleRadius = 0,
  interactive = true,
  onLocationChange,
  style,
  zoom = 16
}, ref) => {
  const webViewRef = useRef<WebView>(null);
  const isLoadedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      webViewRef.current?.injectJavaScript('if (window.map) { window.map.zoomIn(); } true;');
    },
    zoomOut: () => {
      webViewRef.current?.injectJavaScript('if (window.map) { window.map.zoomOut(); } true;');
    },
    animateToRegion: (coords) => {
      webViewRef.current?.injectJavaScript(
        `if (window.setLocation) { window.setLocation(${coords.latitude}, ${coords.longitude}); } true;`
      );
    }
  }));

  // Update map position when latitude/longitude props change from outside (e.g. search or GPS)
  useEffect(() => {
    if (isLoadedRef.current && latitude && longitude) {
      webViewRef.current?.injectJavaScript(
        `if (window.setLocation) { window.setLocation(${latitude}, ${longitude}); } true;`
      );
    }
  }, [latitude, longitude]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * {
          -webkit-tap-highlight-color: transparent;
        }
        body, html, #map {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background: #f1f5f9;
          overflow: hidden;
        }
        .leaflet-control-attribution {
          font-size: 9px !svg;
          opacity: 0.65;
          background: rgba(255,255,255,0.7) !important;
          padding: 1px 5px !important;
        }
        .custom-map-pin {
          background: transparent;
          border: none;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var lat = ${latitude || 28.4510};
        var lon = ${longitude || 77.0784};
        var isInteractive = ${interactive ? 'true' : 'false'};
        var radius = ${circleRadius || 0};

        var map = L.map('map', {
          zoomControl: false,
          attributionControl: true,
          dragging: isInteractive,
          touchZoom: isInteractive,
          scrollWheelZoom: isInteractive,
          doubleClickZoom: isInteractive,
          boxZoom: isInteractive
        }).setView([lat, lon], ${zoom});
        window.map = map;

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        var pinIcon = L.divIcon({
          className: 'custom-map-pin',
          html: '<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;-webkit-filter:drop-shadow(0 3px 4px rgba(0,0,0,0.35));filter:drop-shadow(0 3px 4px rgba(0,0,0,0.35));">' +
                '<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M16 0C7.16344 0 0 7.16344 0 16C0 26.5 16 40 16 40C16 40 32 26.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="#EF4444"/>' +
                '<circle cx="16" cy="15" r="6" fill="#FFFFFF"/>' +
                '</svg>' +
                '</div>',
          iconSize: [32, 40],
          iconAnchor: [16, 40]
        });

        var marker = L.marker([lat, lon], {
          icon: pinIcon,
          draggable: isInteractive
        }).addTo(map);
        window.marker = marker;

        var circle = null;
        if (radius > 0) {
          circle = L.circle([lat, lon], {
            radius: radius,
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.15,
            weight: 2
          }).addTo(map);
        }
        window.circle = circle;

        function notifyLocation(newLat, newLon) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'locationChange',
              latitude: Number(newLat),
              longitude: Number(newLon)
            }));
          }
        }

        if (isInteractive) {
          marker.on('dragend', function(e) {
            var pos = marker.getLatLng();
            if (circle) circle.setLatLng(pos);
            notifyLocation(pos.lat, pos.lng);
          });

          map.on('click', function(e) {
            var pos = e.latlng;
            marker.setLatLng(pos);
            if (circle) circle.setLatLng(pos);
            notifyLocation(pos.lat, pos.lng);
          });
        }

        window.setLocation = function(newLat, newLon) {
          if (!newLat || !newLon) return;
          map.setView([newLat, newLon], map.getZoom() || 16, { animate: true });
          marker.setLatLng([newLat, newLon]);
          if (circle) circle.setLatLng([newLat, newLon]);
        };
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'locationChange' && onLocationChange) {
        onLocationChange({
          latitude: Number(data.latitude),
          longitude: Number(data.longitude)
        });
      }
    } catch (e) {
      console.log('Error parsing map message:', e);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        onLoadEnd={() => {
          isLoadedRef.current = true;
          if (latitude && longitude) {
            webViewRef.current?.injectJavaScript(
              `if (window.setLocation) { window.setLocation(${latitude}, ${longitude}); } true;`
            );
          }
        }}
        onMessage={handleMessage}
        scrollEnabled={interactive}
        nestedScrollEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
        mixedContentMode="always"
        style={styles.webView}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  }
});

export default FreeMapView;
