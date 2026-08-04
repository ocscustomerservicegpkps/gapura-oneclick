export const HEAD_OFFICE_CODE = 'KPS';

export interface GapuraStation {
    code: string;
    name: string;
}

// Canonical station list for account registration. Mirrors the seeded rows in
// the `stations` table (id = code); used as fallback when the DB is unreachable.
export const GAPURA_STATIONS: GapuraStation[] = [
    { code: 'KPS', name: 'Kantor Pusat' },
    { code: 'AAP', name: 'Aji Pangeran Tumenggung Pranoto Airport' },
    { code: 'AMQ', name: 'Pattimura Airport' },
    { code: 'BDJ', name: 'Syamsudin Noor International Airport' },
    { code: 'BDO', name: 'Husein Sastranegara International Airport' },
    { code: 'BIK', name: 'Frans Kaisiepo International Airport' },
    { code: 'BKS', name: 'Fatmawati Soekarno Airport' },
    { code: 'BPN', name: 'Sultan Aji Muhammad Sulaiman Sepinggan Airport' },
    { code: 'BTH', name: 'Hang Nadim International Airport' },
    { code: 'BTJ', name: 'Sultan Iskandar Muda International Airport' },
    { code: 'BWX', name: 'Banyuwangi International Airport' },
    { code: 'CGK', name: 'Soekarno-Hatta International Airport' },
    { code: 'CGO', name: 'CGO' },
    { code: 'DHX', name: 'Dhoho International Airport' },
    { code: 'DJB', name: 'Sultan Thaha Airport' },
    { code: 'DJJ', name: 'Sentani International Airport' },
    { code: 'DPS', name: 'I Gusti Ngurah Rai International Airport' },
    { code: 'DTB', name: 'Sisingamangaraja XII International Airport' },
    { code: 'FLZ', name: 'Ferdinand Lumban Tobing Airport' },
    { code: 'GNS', name: 'Binaka Airport' },
    { code: 'HLP', name: 'Halim Perdanakusuma International Airport' },
    { code: 'JOG', name: 'Adisutjipto International Airport' },
    { code: 'KJT', name: 'Kertajati International Airport' },
    { code: 'KNO', name: 'Kualanamu International Airport' },
    { code: 'KOE', name: 'El Tari International Airport' },
    { code: 'LBJ', name: 'Komodo International Airport' },
    { code: 'LOP', name: 'Lombok International Airport' },
    { code: 'MDC', name: 'Sam Ratulangi International Airport' },
    { code: 'MKQ', name: 'Mopah Airport' },
    { code: 'MKW', name: 'Rendani Airport' },
    { code: 'NBX', name: 'Douw Aturure Airport' },
    { code: 'PDG', name: 'Minangkabau International Airport' },
    { code: 'PGK', name: 'Depati Amir Airport' },
    { code: 'PKU', name: 'Sultan Syarif Kasim II International Airport' },
    { code: 'PLM', name: 'Sultan Mahmud Badaruddin II International Airport' },
    { code: 'PNK', name: 'Supadio International Airport' },
    { code: 'SOC', name: 'Adi Soemarmo International Airport' },
    { code: 'SRG', name: 'Jenderal Ahmad Yani International Airport' },
    { code: 'SUB', name: 'Juanda International Airport' },
    { code: 'TJQ', name: 'H.A.S. Hanandjoeddin Airport' },
    { code: 'TKG', name: 'Radin Inten II Airport' },
    { code: 'TNJ', name: 'Raja Haji Fisabilillah International Airport' },
    { code: 'UPG', name: 'Sultan Hasanuddin International Airport' },
    { code: 'YIA', name: 'Yogyakarta International Airport' },
];
