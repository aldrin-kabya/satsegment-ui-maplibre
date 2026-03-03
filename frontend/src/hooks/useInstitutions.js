import { useState, useEffect } from 'react';
import Papa from 'papaparse';

/**
 * Title-case a string: capitalize the first letter of each word.
 * Handles abbreviations (single letters like "B." or "G") naturally
 * since each is treated as its own word.
 */
function toTitleCase(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Custom hook that loads institution data from CSV and returns a GeoJSON
 * FeatureCollection of Point features, each with a `name` property.
 */
export default function useInstitutions() {
    const [geojson, setGeojson] = useState(null);

    useEffect(() => {
        fetch('/institution_list_U_bd_only.csv')
            .then(res => res.text())
            .then(csvText => {
                const parsed = Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                });

                const features = [];

                for (const row of parsed.data) {
                    const lat = parseFloat(row.Latitude);
                    const lng = parseFloat(row.Longitude);
                    const name = row.INSTITUTE_NAME;

                    if (isNaN(lat) || isNaN(lng) || !name) continue;

                    features.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lng, lat],
                        },
                        properties: {
                            name: toTitleCase(name.trim()),
                        },
                    });
                }

                setGeojson({
                    type: 'FeatureCollection',
                    features,
                });
            })
            .catch(err => {
                console.error('Failed to load institutions CSV:', err);
            });
    }, []);

    return geojson;
}
