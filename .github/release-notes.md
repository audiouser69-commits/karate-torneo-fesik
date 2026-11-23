**Karate Torneo FESIK v1.3** — gestione tornei di karate con regolamento FESIK.

### Download
- **Mac Apple Silicon (M1–M4):** `KarateTorneoFESIK_Mac_AppleSilicon_v1.3.zip`
- **Mac Intel:** `KarateTorneoFESIK_Mac_Intel_v1.3.zip`
- **Windows 10/11:** `KarateTorneoFESIK_Windows_v1.3.zip`

### Mac: primo avvio
L'app ha una firma ad-hoc ma non è autenticata da Apple. Dopo averla trascinata in Applicazioni, se macOS la blocca esegui una volta nel Terminale:
```
xattr -cr "/Applications/Karate Torneo FESIK.app" && codesign --force --deep -s - "/Applications/Karate Torneo FESIK.app"
```

### Novità v1.3
- Tabellone kumite ridisegnato: tatami, categoria con numero automatico, atleti, tempo al centro, penalità JOGAI / ATENAI / MUBOBI, punteggio
- Versione per macOS (Apple Silicon e Intel), menu Modifica, Cmd+Z
- Guide PDF per Windows e Mac nella cartella `docs`
