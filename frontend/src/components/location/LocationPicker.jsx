import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import api from '../../services/api';
import 'leaflet/dist/leaflet.css';
import './LocationPicker.css';

/**
 * Parse coordinates directly from Google Maps URLs, query parameters, or decimal coordinates.
 */
const parseDirectLocation = (text) => {
  if (!text) return null;
  const str = text.trim();

  // 1. Google Maps URL containing coordinates e.g. @18.5634121,73.9442015
  const gmapMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (gmapMatch) {
    const lat = parseFloat(gmapMatch[1]);
    const lon = parseFloat(gmapMatch[2]);
    const placeMatch = str.match(/\/place\/([^/@]+)/);
    const placeName = placeMatch ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : 'Google Maps Location';
    return { place_id: 'direct-gmaps', lat, lon, title: placeName, display_name: `${placeName} (${lat}, ${lon})` };
  }

  // 2. Query param coordinates e.g. ?q=18.5634121,73.9442015
  const qMatch = str.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lon = parseFloat(qMatch[2]);
    return { place_id: 'direct-q', lat, lon, title: 'Coordinates', display_name: `Location (${lat}, ${lon})` };
  }

  // 3. Raw decimal coordinates e.g. "18.5634121, 73.9442015" or "18.5634121 73.9442015"
  const decMatch = str.match(/^\s*(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)\s*$/);
  if (decMatch) {
    const lat = parseFloat(decMatch[1]);
    const lon = parseFloat(decMatch[2]);
    return { place_id: 'direct-dec', lat, lon, title: 'Coordinates', display_name: `Latitude: ${lat}, Longitude: ${lon}` };
  }

  return null;
};

/**
 * Controller component inside MapContainer to handle map events and programmatically fly/pan.
 */
const MapEventsHandler = ({ onMoveStart, onMoveEnd, onMove, onMapClick, mapRef }) => {
  const map = useMapEvents({
    movestart: () => {
      onMoveStart && onMoveStart();
    },
    move: () => {
      const center = map.getCenter();
      onMove && onMove({ lat: center.lat, lng: center.lng });
    },
    moveend: () => {
      const center = map.getCenter();
      onMoveEnd && onMoveEnd({ lat: center.lat, lng: center.lng });
    },
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng);
      }
    },
  });

  useEffect(() => {
    if (mapRef) {
      mapRef.current = map;
    }
    // Invalidate size on mount and window resize to prevent gray/invisible tiles
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map, mapRef]);

  return null;
};

/**
 * LocationPicker Component
 * A 100% free, food-delivery-style (Swiggy/Zomato) interactive location picker.
 * Uses Leaflet and OpenStreetMap (OSM) standard tiles + Nominatim Search & Reverse APIs.
 *
 * @param {Object} props
 * @param {[number, number]} [props.initialCenter=[20.5937, 78.9629]] - [lat, lng]
 * @param {number} [props.initialZoom=15] - Initial map zoom level
 * @param {function} props.onLocationSelect - Callback receiving { lat, lng, address, details }
 * @param {function} [props.onCancel] - Optional callback when cancel/close is clicked
 * @param {string} [props.confirmButtonText='Confirm Location'] - Text for confirmation button
 * @param {string} [props.height='520px'] - Height of map container
 */
const LocationPicker = ({
  initialCenter = [18.5204, 73.8567],
  initialZoom = 15,
  initialAddress = '',
  onLocationSelect,
  onCoordinatesChange,
  onCancel,
  onClose,
  confirmButtonText = 'Confirm Location',
  height = '100%',
}) => {
  const mapRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const reverseDebounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isProgrammaticFlyRef = useRef(false);

  // Coordinates state
  const [coordinates, setCoordinates] = useState({
    lat: initialCenter[0],
    lng: initialCenter[1],
  });

  // UI States
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isReverseLoading, setIsReverseLoading] = useState(false);
  const [addressData, setAddressData] = useState({
    title: 'Loading location...',
    fullAddress: '',
    raw: null,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialAddress || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchError, setSearchError] = useState('');

  /**
   * Helper to build a clean, deduplicated, highly accurate reverse geocoded address
   * formatted specifically for precision in Google Maps and navigation.
   */
  const buildPrecisionAddress = (props) => {
    if (!props) return '';
    const parts = [];
    const addedTokens = new Set();

    const add = (val) => {
      if (!val) return;
      const clean = String(val).trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!addedTokens.has(key)) {
        addedTokens.add(key);
        parts.push(clean);
      }
    };

    // 1. House Number / Building / Specific Landmark Name
    const streetName = props.street || props.road;
    if (props.housenumber && streetName) {
      add(`${props.housenumber} ${streetName}`);
    } else {
      if (props.housenumber) add(props.housenumber);
      if (props.building) add(props.building);
      if (props.name && props.name !== streetName) {
        add(props.name);
      }
    }

    // 2. Road / Street
    if (props.road) add(props.road);
    if (props.street && props.street !== props.road) add(props.street);

    // 3. Locality / Suburb / Neighbourhood
    if (props.neighbourhood || props.neighborhood) add(props.neighbourhood || props.neighborhood);
    if (props.suburb) add(props.suburb);
    if (props.locality && props.locality !== props.suburb) add(props.locality);
    if (props.residential) add(props.residential);

    // 4. District / Ward / Area
    if (props.district) add(props.district);
    if (props.county && props.county !== props.district) add(props.county);
    if (props.state_district && props.state_district !== props.district) add(props.state_district);

    // 5. City / Town / Village
    if (props.city) add(props.city);
    if (props.town && props.town !== props.city) add(props.town);
    if (props.village) add(props.village);
    if (props.municipality) add(props.municipality);

    // 6. State
    if (props.state) add(props.state);

    // 7. Postal Code
    const postcode = props.postcode || props.postal_code || props.postCode;

    // 8. Country
    const country = props.country || props.country_name || props.countryName;

    let formatted = parts.join(', ');
    if (postcode) {
      formatted += ` ${postcode}`;
    }
    if (country && !addedTokens.has(country.toLowerCase())) {
      formatted += `, ${country}`;
    }

    return formatted;
  };

  /**
   * Reverse Geocoding with OpenStreetMap (Photon + Nominatim + BigDataCloud)
   * Produces exact pinpoint address ready for Google Maps navigation.
   */
  const fetchAddressForCoordinates = useCallback(async (lat, lng) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsReverseLoading(true);
    const formattedLat = Number(lat).toFixed(6);
    const formattedLng = Number(lng).toFixed(6);

    try {
      // 1. Primary: Photon Reverse API (Instant, high detail, house/road level)
      try {
        const photonUrl = `https://photon.komoot.io/reverse?lat=${formattedLat}&lon=${formattedLng}`;
        const photonRes = await fetch(photonUrl, { signal: controller.signal });
        if (photonRes.ok) {
          const photonData = await photonRes.json();
          if (controller.signal.aborted) return;
          if (photonData && photonData.features && photonData.features.length > 0) {
            const props = photonData.features[0].properties;
            const precisionAddr = buildPrecisionAddress(props);

            if (precisionAddr) {
              const mainTitle =
                props.name ||
                props.street ||
                props.locality ||
                props.district ||
                props.city ||
                'Pinned Location';

              setAddressData({
                title: mainTitle,
                fullAddress: precisionAddr,
                raw: { address: props, display_name: precisionAddr },
              });
              setIsReverseLoading(false);
              return;
            }
          }
        }
      } catch (photonErr) {
        if (photonErr.name === 'AbortError' || controller.signal.aborted) return;
      }

      if (controller.signal.aborted) return;

      // 2. Fallback: Nominatim Reverse API with zoom 18
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${formattedLat}&lon=${formattedLng}&zoom=18&addressdetails=1`;
        const nomRes = await fetch(nomUrl, { signal: controller.signal });
        if (nomRes.ok) {
          const data = await nomRes.json();
          if (controller.signal.aborted) return;
          if (data && data.address) {
            const addr = data.address;
            const precisionAddr = buildPrecisionAddress(addr) || data.display_name;
            const mainTitle =
              addr.suburb ||
              addr.neighbourhood ||
              addr.road ||
              addr.residential ||
              addr.commercial ||
              addr.city ||
              addr.town ||
              addr.village ||
              'Selected Location';

            setAddressData({
              title: mainTitle,
              fullAddress: precisionAddr,
              raw: data,
            });
            setIsReverseLoading(false);
            return;
          }
        }
      } catch (nomErr) {
        if (nomErr.name === 'AbortError' || controller.signal.aborted) return;
      }

      if (controller.signal.aborted) return;

      // 3. Fallback: BigDataCloud Client Reverse Geocoder
      try {
        const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${formattedLat}&longitude=${formattedLng}&localityLanguage=en`;
        const bdcRes = await fetch(bdcUrl, { signal: controller.signal });
        if (bdcRes.ok) {
          const bdcData = await bdcRes.json();
          if (controller.signal.aborted) return;
          if (bdcData && bdcData.locality) {
            const bdcAddr = [
              bdcData.locality,
              bdcData.city,
              bdcData.principalSubdivision,
              bdcData.postcode,
              bdcData.countryName,
            ]
              .filter(Boolean)
              .join(', ');

            setAddressData({
              title: bdcData.locality || bdcData.city || 'Pinned Location',
              fullAddress: bdcAddr,
              raw: bdcData,
            });
            setIsReverseLoading(false);
            return;
          }
        }
      } catch (bdcErr) {
        if (bdcErr.name === 'AbortError' || controller.signal.aborted) return;
      }

      if (!controller.signal.aborted) {
        setAddressData({
          title: 'Pinned Location',
          fullAddress: `Latitude: ${formattedLat}, Longitude: ${formattedLng}`,
          raw: null,
        });
        setIsReverseLoading(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && !controller.signal.aborted) {
        console.warn('Reverse geocoding error:', err);
        setAddressData({
          title: 'Pinned Location',
          fullAddress: `Lat: ${formattedLat}, Lng: ${formattedLng}`,
          raw: null,
        });
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsReverseLoading(false);
      }
    }
  }, []);

  // Fetch initial address on mount
  useEffect(() => {
    fetchAddressForCoordinates(initialCenter[0], initialCenter[1]);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAddressForCoordinates, initialCenter]);

  /**
   * Search / Forward Geocoding with Debounce
   * Supports: Direct Google Maps URLs, Coordinates, Photon OSM with local proximity bias, and Backend Geocoding
   */
  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSearchError('');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim() || value.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setIsSearching(false);
      return;
    }

    // Check for direct Google Maps link or coordinates match
    const directMatch = parseDirectLocation(value);
    if (directMatch) {
      setSearchResults([directMatch]);
      setShowSearchResults(true);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const query = value.trim();
        let items = [];
        const seenCoordinates = new Set();

        const addResult = (item) => {
          const key = `${Number(item.lat).toFixed(4)},${Number(item.lon).toFixed(4)}`;
          if (!seenCoordinates.has(key)) {
            seenCoordinates.add(key);
            items.push(item);
          }
        };

        // 1. Primary: Photon OSM Geocoding API with local coordinate bias
        try {
          const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${coordinates.lat || 18.5204}&lon=${coordinates.lng || 73.8567}&limit=6`;
          const photonRes = await fetch(photonUrl);
          if (photonRes.ok) {
            const data = await photonRes.json();
            if (data && data.features && data.features.length > 0) {
              data.features.forEach((f, i) => {
                const p = f.properties;
                const fullAddr = [
                  p.name,
                  p.street,
                  p.district || p.suburb,
                  p.city || p.county,
                  p.state,
                  p.postcode,
                  p.country,
                ]
                  .filter(Boolean)
                  .join(', ');

                addResult({
                  place_id: p.osm_id ? `osm-${p.osm_id}` : `photon-${i}`,
                  lat: f.geometry.coordinates[1],
                  lon: f.geometry.coordinates[0],
                  display_name: fullAddr || p.name || query,
                  title: p.name || p.street || 'Place',
                  raw: p,
                });
              });
            }
          }
        } catch (photonErr) {
          console.warn('Photon search error:', photonErr);
        }

        // 2. Backend Multi-Strategy Geocode API (ArcGIS, Plus Codes, Mapbox)
        try {
          const backendRes = await api.get('/cases/geocode-search', { params: { query } });
          if (backendRes.data && backendRes.data.success && Array.isArray(backendRes.data.results)) {
            backendRes.data.results.forEach((r, i) => {
              addResult({
                place_id: `backend-geo-${i}`,
                lat: parseFloat(r.lat),
                lon: parseFloat(r.lng),
                display_name: r.display_name || query,
                title: r.title || query,
                raw: r,
              });
            });
          }
        } catch (backendErr) {
          console.warn('Backend geocode search error:', backendErr);
        }

        // 3. Fallback to Nominatim Search API if items are few
        if (items.length < 3) {
          try {
            const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
              query
            )}&limit=5&addressdetails=1`;
            const nomRes = await fetch(nomUrl);
            if (nomRes.ok) {
              const nomData = await nomRes.json();
              if (Array.isArray(nomData) && nomData.length > 0) {
                nomData.forEach((item) => {
                  addResult({
                    place_id: item.place_id,
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon),
                    display_name: item.display_name,
                    title: item.display_name.split(',')[0],
                    raw: item,
                  });
                });
              }
            }
          } catch (nomErr) {
            console.warn('Nominatim fallback error:', nomErr);
          }
        }

        setSearchResults(items);
        if (items.length === 0) {
          setSearchError('No matching locations found. Try entering area, society name, or paste a Google Maps link.');
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setSearchError('Failed to fetch search results. Please check your network.');
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  /**
   * Selection of search result
   */
  const handleSelectSearchResult = (result) => {
    const targetLat = parseFloat(result.lat);
    const targetLng = parseFloat(result.lon);

    setCoordinates({ lat: targetLat, lng: targetLng });
    setShowSearchResults(false);
    setSearchQuery(result.display_name.split(',')[0]);

    // Instantly apply the exact search result address data
    setAddressData({
      title: result.title || result.display_name.split(',')[0],
      fullAddress: result.display_name,
      raw: result.raw || result,
    });

    if (onCoordinatesChange) {
      onCoordinatesChange({
        lat: Number(targetLat.toFixed(6)),
        lng: Number(targetLng.toFixed(6)),
      });
    }

    isProgrammaticFlyRef.current = true;

    if (mapRef.current) {
      mapRef.current.flyTo([targetLat, targetLng], 16, {
        duration: 1.2,
      });
    }
  };

  /**
   * Clear search input
   */
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchError('');
  };

  /**
   * Click on map handler to immediately move pin to clicked coordinate
   */
  const handleMapClick = (latlng) => {
    const precisionLat = Number(Number(latlng.lat).toFixed(6));
    const precisionLng = Number(Number(latlng.lng).toFixed(6));

    setCoordinates({ lat: precisionLat, lng: precisionLng });
    if (onCoordinatesChange) {
      onCoordinatesChange({ lat: precisionLat, lng: precisionLng });
    }

    isProgrammaticFlyRef.current = true;
    if (mapRef.current) {
      mapRef.current.flyTo([precisionLat, precisionLng], mapRef.current.getZoom(), {
        duration: 0.5,
      });
    }
    fetchAddressForCoordinates(precisionLat, precisionLng);
  };

  /**
   * Geolocation "Locate Me" button handler
   * Uses high-accuracy device location watching with immediate refinement
   */
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);

    let bestPosition = null;
    let watchId = null;
    let timeoutId = null;

    const finalizeLocation = (position) => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch (e) {}
        watchId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!position) {
        setIsLocating(false);
        alert('Could not determine your location. Please check your browser location permissions.');
        return;
      }

      const { latitude, longitude } = position.coords;
      const precisionLat = Number(Number(latitude).toFixed(6));
      const precisionLng = Number(Number(longitude).toFixed(6));

      setCoordinates({ lat: precisionLat, lng: precisionLng });
      if (onCoordinatesChange) {
        onCoordinatesChange({ lat: precisionLat, lng: precisionLng });
      }

      isProgrammaticFlyRef.current = true;
      if (mapRef.current) {
        mapRef.current.flyTo([precisionLat, precisionLng], 17, {
          duration: 1.2,
        });
      }
      fetchAddressForCoordinates(precisionLat, precisionLng);
      setIsLocating(false);
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const acc = position.coords.accuracy || 99999;
          if (!bestPosition || acc < (bestPosition.coords.accuracy || 99999)) {
            bestPosition = position;
          }

          if (acc <= 50) {
            finalizeLocation(bestPosition);
          }
        },
        (error) => {
          console.warn('watchPosition error:', error);
          if (error.code === 1) { // PERMISSION_DENIED
            finalizeLocation(null);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
    } catch (e) {
      console.warn('watchPosition exception:', e);
    }

    timeoutId = setTimeout(() => {
      if (bestPosition) {
        finalizeLocation(bestPosition);
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => finalizeLocation(pos),
          (err) => {
            console.error('Final fallback error:', err);
            finalizeLocation(null);
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      }
    }, 6000);
  };

  /**
   * Map move event handlers
   */
  const handleMapMoveStart = () => {
    setIsMapMoving(true);
  };

  const handleMapMove = (center) => {
    setCoordinates(center);
    if (onCoordinatesChange) {
      onCoordinatesChange({
        lat: Number(center.lat.toFixed(6)),
        lng: Number(center.lng.toFixed(6)),
      });
    }
  };

  const handleMapMoveEnd = (center) => {
    setIsMapMoving(false);
    setCoordinates(center);
    if (onCoordinatesChange) {
      onCoordinatesChange({
        lat: Number(center.lat.toFixed(6)),
        lng: Number(center.lng.toFixed(6)),
      });
    }

    if (isProgrammaticFlyRef.current) {
      isProgrammaticFlyRef.current = false;
      return;
    }

    if (reverseDebounceTimerRef.current) {
      clearTimeout(reverseDebounceTimerRef.current);
    }

    reverseDebounceTimerRef.current = setTimeout(() => {
      fetchAddressForCoordinates(center.lat, center.lng);
    }, 200);
  };

  /**
   * Confirm Location Callback
   */
  const handleConfirmLocation = () => {
    const precisionLat = typeof coordinates.lat === 'number' ? Number(coordinates.lat.toFixed(7)) : parseFloat(coordinates.lat);
    const precisionLng = typeof coordinates.lng === 'number' ? Number(coordinates.lng.toFixed(7)) : parseFloat(coordinates.lng);
    const finalAddress = addressData.fullAddress || (searchQuery ? searchQuery : `${precisionLat}, ${precisionLng}`);

    if (onLocationSelect) {
      onLocationSelect({
        lat: precisionLat,
        lng: precisionLng,
        address: finalAddress,
        title: addressData.title || searchQuery || 'Pinned Location',
        details: addressData.raw,
      });
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="location-picker-container" style={{ height }}>
      {/* 1. Floating Search Bar Overlay */}
      <div className="location-search-overlay">
        <div className="location-search-bar">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#17539C"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: '6px', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>

          <input
            type="text"
            className="location-search-input"
            placeholder="Search for area, street name, landmark..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            onFocus={() => {
              if (searchResults.length > 0) setShowSearchResults(true);
            }}
          />

          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClearSearch}
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className="location-suggestions-dropdown">
            {isSearching && (
              <div className="search-loading-item">
                <div className="pulse-dot"></div>
                <span>Searching places...</span>
              </div>
            )}

            {!isSearching && searchError && (
              <div className="search-empty-item">
                <span>{searchError}</span>
              </div>
            )}

            {!isSearching &&
              searchResults.map((item, idx) => {
                const parts = item.display_name.split(',');
                const mainName = parts[0];
                const secondaryName = parts.slice(1).join(',').trim();

                return (
                  <div
                    key={item.place_id || idx}
                    className="location-suggestion-item"
                    onClick={() => handleSelectSearchResult(item)}
                  >
                    <div className="suggestion-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                    </div>
                    <div className="suggestion-text">
                      <div className="suggestion-primary">{mainName}</div>
                      {secondaryName && <div className="suggestion-secondary">{secondaryName}</div>}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 2. Interactive Map */}
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        className="location-picker-map"
        style={{ width: '100%', height: '100%', minHeight: '100%', position: 'absolute', top: 0, left: 0 }}
        zoomControl={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        />
        <MapEventsHandler
          onMoveStart={handleMapMoveStart}
          onMove={handleMapMove}
          onMoveEnd={handleMapMoveEnd}
          onMapClick={handleMapClick}
          mapRef={mapRef}
        />
      </MapContainer>

      {/* 3. Static Center Pin UX: 3D Pointed Pushpin */}
      <div className={`center-pin-wrapper ${isMapMoving ? 'is-moving' : ''}`}>
        <div className="center-pin-tooltip">
          {isMapMoving ? (
            'Adjusting location...'
          ) : isReverseLoading ? (
            <>
              <div className="pulse-dot"></div>
              <span>Locating address...</span>
            </>
          ) : (
            'Pinned Location'
          )}
        </div>

        {/* Realistic ground contact shadow directly under the needle tip */}
        <div className="center-pin-shadow"></div>

        {/* 3D Pointed Red Pushpin */}
        <div className="center-pin-icon">
          <svg
            width="60"
            height="70"
            viewBox="0 0 60 70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* 3D Sphere Radial Gradient */}
              <radialGradient
                id="pinSphereGrad"
                cx="35%"
                cy="28%"
                r="65%"
                fx="32%"
                fy="24%"
              >
                <stop offset="0%" stopColor="#ff7b73" />
                <stop offset="22%" stopColor="#ff382e" />
                <stop offset="60%" stopColor="#dc1e14" />
                <stop offset="88%" stopColor="#a3110a" />
                <stop offset="100%" stopColor="#6e0803" />
              </radialGradient>

              {/* Metallic Needle Shading */}
              <linearGradient id="needleMainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="25%" stopColor="#f1f5f9" />
                <stop offset="55%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>

              {/* Dark Needle Edge Shade */}
              <linearGradient id="needleDarkEdge" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>

              {/* Sphere Ambient Occlusion under ball */}
              <radialGradient id="sphereUnderShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
            </defs>

            {/* Needle Body (Tapered down to exact sharp tip at 15, 62) */}
            <polygon points="15,62 26.5,27.5 30.5,29.5" fill="url(#needleMainGrad)" />
            <polygon points="15,62 26.5,27.5 28.5,28.5" fill="url(#needleDarkEdge)" opacity="0.65" />
            
            {/* Needle Specular Ridge Highlight */}
            <line x1="28.5" y1="28.5" x2="15.5" y2="61" stroke="#ffffff" strokeWidth="0.85" opacity="0.85" />

            {/* Shadow under sphere onto the needle collar */}
            <ellipse cx="28.5" cy="28.5" rx="4.5" ry="2.5" fill="url(#sphereUnderShadow)" />

            {/* 3D Red Sphere */}
            <circle cx="36" cy="19" r="16.5" fill="url(#pinSphereGrad)" />

            {/* Glossy White Specular Reflection */}
            <ellipse
              cx="32"
              cy="13.5"
              rx="4.5"
              ry="3.2"
              transform="rotate(-15 32 13.5)"
              fill="#ffffff"
              opacity="0.92"
            />
            <circle cx="37" cy="11.5" r="1.5" fill="#ffffff" opacity="0.75" />

            {/* Subtle bottom edge reflective bounce light */}
            <path
              d="M 23.5 27 A 16.5 16.5 0 0 0 46.5 28"
              stroke="rgba(255, 255, 255, 0.28)"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {/* 4. Floating "Locate Me" Button */}
      <button
        type="button"
        className="locate-me-btn"
        onClick={handleLocateMe}
        title="Use Current Location"
      >
        {isLocating ? (
          <div className="pulse-dot" style={{ width: '12px', height: '12px' }}></div>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="22" y1="12" x2="18" y2="12"></line>
            <line x1="6" y1="12" x2="2" y2="12"></line>
            <line x1="12" y1="6" x2="12" y2="2"></line>
            <line x1="12" y1="22" x2="12" y2="18"></line>
            <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
          </svg>
        )}
      </button>

      {/* 5. Bottom Confirmation Sheet */}
      <div className="location-bottom-sheet">
        <div className="bottom-sheet-handle"></div>

        <div className="bottom-sheet-content">
          <div className="address-icon-wrapper">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>

          <div className="address-text-container">
            <div className="address-title-row">
              <span className="address-main-title">{addressData.title || 'Selected Location'}</span>
              {isReverseLoading ? (
                <span className="address-status-badge loading">
                  <div className="pulse-dot" style={{ width: '6px', height: '6px' }}></div>
                  Fetching Address...
                </span>
              ) : (
                <span className="address-status-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Location Selected
                </span>
              )}
            </div>

            <p className="address-full-text">
              {isReverseLoading
                ? 'Resolving precise street & area details from OpenStreetMap...'
                : addressData.fullAddress || 'Drag the map to select your exact location.'}
            </p>

            {/* Coordinates Display Badges */}
            <div className="coordinates-row">
              <span className="coord-chip">
                <span className="coord-label">LAT:</span> {Number(coordinates.lat).toFixed(6)}
              </span>
              <span className="coord-chip">
                <span className="coord-label">LNG:</span> {Number(coordinates.lng).toFixed(6)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: '0 0 auto',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                color: '#4b5563',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            className="confirm-location-btn"
            onClick={handleConfirmLocation}
            disabled={isReverseLoading || isMapMoving}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
