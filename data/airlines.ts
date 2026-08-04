
export const AIRLINES = [

    { code: 'GA', name: 'Garuda Indonesia', type: 'Full Service', logo: '' },
    { code: 'QG', name: 'Citilink', type: 'LCC', logo: '' },
    { code: 'JT', name: 'Lion Air', type: 'LCC', logo: '' },
    { code: 'ID', name: 'Batik Air', type: 'Full Service', logo: '' },
    { code: 'IW', name: 'Wings Air', type: 'Regional', logo: '' },
    { code: 'QZ', name: 'Indonesia AirAsia', type: 'LCC', logo: '' },
    { code: 'IU', name: 'Super Air Jet', type: 'LCC', logo: '' },
    { code: 'SJ', name: 'Sriwijaya Air', type: 'Medium Service', logo: '' },
    { code: 'IN', name: 'NAM Air', type: 'Regional', logo: '' },
    { code: 'IP', name: 'Pelita Air', type: 'Medium Service', logo: '' },
    { code: '8B', name: 'TransNusa', type: 'Medium Service', logo: '' },

    { code: 'SQ', name: 'Singapore Airlines', type: 'International', logo: '' },
    { code: 'MH', name: 'Malaysia Airlines', type: 'International', logo: '' },
    { code: 'TR', name: 'Scoot', type: 'International', logo: '' },
    { code: 'AK', name: 'AirAsia', type: 'International', logo: '' },
    { code: 'OD', name: 'Batik Air Malaysia', type: 'International', logo: '' },
    { code: 'JL', name: 'Japan Airlines', type: 'International', logo: '' },
    { code: 'NH', name: 'All Nippon Airways (ANA)', type: 'International', logo: '' },
    { code: 'KE', name: 'Korean Air', type: 'International', logo: '' },
    { code: 'OZ', name: 'Asiana Airlines', type: 'International', logo: '' },
    { code: 'CI', name: 'China Airlines', type: 'International', logo: '' },
    { code: 'BR', name: 'EVA Air', type: 'International', logo: '' },
    { code: 'CX', name: 'Cathay Pacific', type: 'International', logo: '' },
    { code: 'CZ', name: 'China Southern Airlines', type: 'International', logo: '' },
    { code: 'MU', name: 'China Eastern Airlines', type: 'International', logo: '' },
    { code: 'CA', name: 'Air China', type: 'International', logo: '' },
    { code: 'MF', name: 'Xiamen Air', type: 'International', logo: '' },

    { code: 'EK', name: 'Emirates', type: 'International', logo: '' },
    { code: 'QR', name: 'Qatar Airways', type: 'International', logo: '' },
    { code: 'EY', name: 'Etihad Airways', type: 'International', logo: '' },
    { code: 'SV', name: 'Saudia', type: 'International', logo: '' },
    { code: 'TK', name: 'Turkish Airlines', type: 'International', logo: '' },
    { code: 'WY', name: 'Oman Air', type: 'International', logo: '' },

    { code: 'KL', name: 'KLM Royal Dutch Airlines', type: 'International', logo: '' },
    { code: 'QF', name: 'Qantas', type: 'International', logo: '' },
    { code: 'JQ', name: 'Jetstar Airways', type: 'International', logo: '' },
] as const;

export type AirlineCode = typeof AIRLINES[number]['code'];
