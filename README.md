# Karate Torneo FESIK

Software per gestire tornei di karate con regolamento FESIK (Windows e macOS, Electron).

- Import atleti da Excel, generazione categorie (età, sesso, cinture, peso, stile)
- Sorteggio con separazione società; finale, girone all'italiana, eliminazione diretta con/senza recupero
- Kumite (Shobu Sanbon/Nihon/Ippon) e Kata (punteggio o bandierine)
- Tabellone su TV via HDMI (tatami, categoria e numero, tempo, Jogai/Atenai/Mubobi, punteggio)
- Grafiche evento con figure pixel art e programma delle fasi
- Risultati live online (Firebase + pagina pubblica su Netlify), QR code sul tabellone
- Esportazione risultati in Excel

## Sviluppo

```
npm install
npm start
```

## Compilazione

```
npm run dist:win     # Windows x64
npm run dist:mac     # macOS Apple Silicon + Intel (non firmata)
```

Le istruzioni d'uso sono in `LEGGIMI.txt`, `LEGGIMI_MAC.txt` e nella guida PDF in `docs/`.
