# Karate Torneo FESIK — storico del progetto

Riepilogo della conversazione con Claude (21–23 novembre 2026), da usare per riprendere il lavoro in futuro.
Basta allegare questo file e lo zip dei sorgenti a una nuova chat e scrivere cosa si vuole cambiare.

## Richieste, in ordine

1. **21/11 – Software di gestione torneo FESIK.** Partendo da una lista atleti in Excel: categorie, sorteggio, tabellone degli incontri con indicazione della formula (eliminazione diretta o altro), punteggio live su TV/monitor via HDMI (punteggio, tempo rimasto, penalità) come nella foto di riferimento (AKA rosso a sinistra, SHIRO bianco a destra, tempo 3:00 al centro), e aggiornamento via Internet su un sito.
   - Scelte di Emilio: **Kumite + Kata**, **app Windows .exe**, pubblicazione online con **Firebase gratuito**, **modello Excel standard**.
   - Consegnata la versione 1.0.
2. **23/11 – Grafiche informative per il pubblico.** L'operatore scrive il nome della fase (es. "Premiazione") e lo abbina a una figura pixel art (karateka generico, karateka con coppa d'oro, ecc.), in una scheda dedicata. Consegnata la versione 1.1.
3. **23/11 – Pubblicazione dei risultati "su Google".** Spiegata la configurazione di Firebase (Google) e la pubblicazione della pagina.
4. **23/11 – Configurazione degli account dentro il software**, senza browser esterni, e domanda se la pagina pubblica è gratuita. Consegnata la versione 1.3.
5. **23/11 – Domande:** com'è la schermata QR, com'è la pagina live, se le immagini sull'HDMI richiedono un tasto di pubblicazione (risposta: no, il tabellone si aggiorna da solo; solo le grafiche si mandano con "Manda in onda").
6. **23/11 – Guida PDF completa e salvataggio di questa conversazione** (questo file).

## Cosa fa il software (versione 1.3)

- **Torneo**: nome, data (per l'età), luogo, numero tatami; import Excel; genera categorie; sorteggia; salva/apri torneo su file; salvataggio automatico.
- **Atleti**: elenco con età e classe calcolate, ricerca, aggiunta/modifica/eliminazione.
- **Categorie**: generazione per specialità, classe d'età, sesso, gruppo cinture, peso (kumite), stile (kata); modifica, unione, atleti spostabili, tatami assegnato.
- **Sorteggio e formule**: 1 atleta = primo a tavolino; 2 = finale; fino a 3 = girone all'italiana; 4+ = eliminazione diretta con recupero (o semplice con 3° pari merito); separazione atleti della stessa società; bye; recuperi creati quando sono noti i finalisti.
- **Tabellone**: vista grafica dei turni, recuperi, girone con spareggio manuale, stampa.
- **Incontro live kumite**: Sanbon/Nihon/Ippon; tasti rapidi (Spazio, Q/W/A/Z/X per AKA, O/P/L/M/N per SHIRO, Ctrl+Z); stop automatico a punteggio pieno; Atoshi Baraku; regole Jogai; Chui → Hansoku; Kiken; fine tempo con vantaggio/penalità → Hantei; parità → Encho-sen (Sanbon), Sai Shiai (Ippon), Hantei (Nihon), Hikiwake (girone); conferma e passaggio automatico al prossimo incontro.
- **Kata**: a punteggio (3 o 5 giudici, scarto del voto più alto e del più basso, spareggi, turni Eliminatorie/Semifinale/Finale con scale 5–7, 6–8, 7–9, finalisti 8 Ragazzi / 6 altri) oppure a bandierine.
- **Tabellone TV HDMI**: finestra a schermo intero sul secondo schermo; punteggi, tempo, penalità, vincitore, voti kata, classifiche, prossimi incontri; suoni; nessun tasto di pubblicazione.
- **Grafiche evento**: titolo, sottotitolo, testo, etichetta; 11 figure pixel art originali (karateka che dà un pugno, karateka con coppa, saluto, calcio, arbitro, podio, medaglia, pausa, orologio, kata, megafono) + immagine propria (pixelabile) + QR code; 6 temi colore; animazione; programma delle fasi con fase in corso; "Manda in onda" / "Torna al tabellone gare".
- **Classifiche**: podi, medagliere per società, esportazione Excel (Classifiche, Incontri, Categorie).
- **Account e online**: finestra browser interna; Firebase (database) con rilevamento automatico di indirizzo e secret; Netlify (pagina pubblica) con token, pubblicazione dal programma, link e QR code; "QR sul tabellone".
- **Pagina live**: tatami in diretta (con grafiche), categorie con ricerca, medagliere; lettura ogni 3 secondi, solo categorie cambiate.
- **Regole**: classi d'età, pesi, cinture, formula, giudici kata, tempi, separazione società.

## Decisioni tecniche

- App **Electron** (Windows x64), interfaccia HTML/JS. File principali:
  - `main.js` (finestre, file, finestra browser interna, rilevamento dati, pubblicazione Netlify via API "file digest"), `preload.js`
  - `app/core.js` (logica: import, categorie, sorteggio, tabellone, recuperi, girone, kata, regole incontro, snapshot pubblico)
  - `app/app.js` (interfaccia), `app/index.html`, `app/style.css`
  - `app/scoreboard.html` (tabellone TV), `app/pixelart.js` (figure), `app/infoscreen.js` (schermata grafiche), `app/vendor/` (SheetJS, qrcode-generator)
  - `live/index.html` (pagina pubblica; il programma inserisce indirizzo DB, codice torneo e script delle figure)
- Dati online: `tornei/<codice>/info`, `categories/<id>`, `ver/<id>`, `live/tatami<N>`. Regole Firebase: lettura pubblica, scrittura solo con il secret del database.
- Più tatami: ogni PC pubblica solo le categorie del proprio tatami e il proprio incontro in corso.
- Il token Netlify resta solo sul PC (non nel file del torneo).
- Pacchetto creato con `@electron/packager` (`npm run dist`).

## Limiti dei servizi gratuiti (verificati a novembre 2026)

- **Firebase Spark**: massimo 100 connessioni contemporanee (non aumentabili), circa 10 GB/mese di download; se si supera, il servizio si ferma senza addebiti.
- **Netlify Free**: 300 crediti/mese con limite rigido; 15 crediti per pubblicazione; banda a crediti per GB.

## Da verificare / punti aperti

- Le **categorie di peso** predefinite sono provvisorie (non trovate nel regolamento arbitrale FESIK 15/02/2025): controllarle con la circolare della gara.
- Mai provati dal vivo: uso su un PC Windows reale con TV, collegamento reale a Firebase, pubblicazione reale su Netlify, accesso Google dalla finestra interna (Google può rifiutarlo: in quel caso usare il browser e incollare i dati).
- Il programma non è firmato: Windows lo segnala al primo avvio.
- Idee possibili per il futuro: doppia finale Campionato/Coppa, più tabelloni su più schermi dallo stesso PC, stampa diplomi, pesatura con bilancia.

## File consegnati

- `KarateTorneoFESIK_Windows_v1.3.zip` — programma
- `KarateTorneoFESIK_sorgenti_v1.3.zip` — codice sorgente
- `Guida_Karate_Torneo_FESIK.pdf` — guida completa
- `Storico_progetto_Karate_Torneo_FESIK.md` — questo file

## Aggiornamento 23/11 – versione 1.3

- Tabellone kumite rifatto secondo lo schema disegnato da Emilio: in alto TATAMI · KUMITE (categoria) · numero della categoria in un riquadro (automatico); AKA a sinistra e SHIRO a destra con nome e società; tempo al centro sulla linea divisoria; in basso penalità e punteggio "1 - 0". Colori invariati (rosso/bianco).
- Penalità esclusivamente JOGAI, ATENAI, MUBOBI (contatori), anche nei comandi e nella pagina live; tolti Chui/Hansoku e l'escalation automatica dei Jogai. Kiken rimane come "ritiro".
- Tasti: AKA Z jogai, X atenai, C mubobi; SHIRO M jogai, N atenai, B mubobi.
- Punteggio mostrato in Ippon, con l'indicazione "+ WAZA-ARI" quando c'è mezzo punto. A fine incontro il riquadro del tempo diventa "VINCE AKA/SHIRO".

## Repository e release

- Codice su GitHub: https://github.com/audiouser69-commits/karate-torneo-fesik (privato)
- Le release si generano con GitHub Actions (`.github/workflows/release.yml`, avvio manuale da Actions > "Build e release" > Run workflow): compila Windows e Mac (Mac con firma ad-hoc) e pubblica la release con il numero di versione di `package.json`.
- Release v1.3.0: https://github.com/audiouser69-commits/karate-torneo-fesik/releases/tag/v1.3.0
