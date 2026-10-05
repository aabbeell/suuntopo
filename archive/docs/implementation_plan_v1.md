# SUUNTOPO — Implementation Plan

## Cél (Best Case Scenario)

Egy interaktív mászótopo-megjelenítő a Suunto Race S (és kompatibilis Suunto) órákra,
SuuntoPlus Sports App formájában.

### Mit csinál

1. **Topo megjelenítés az órán**: A mászóút teljes topója megjelenik a 466×466 px-es
   kijelzőn, bezoomolva. A felhasználó az útvonal mentén navigál anchor-ról anchor-ra
   (tap/doubleTap/lap gombokkal). A fókusz az útvonal vonalát követi — nem feltétlenül
   vertikálisan, hanem ahogy a mászóút halad.

2. **Sziklajellegzetességek**: A topo nem csak vonal + anchorok, hanem a szikla
   jellegzetességei is látszanak (repedések, túlhajlások, párkányok, falkontúr stb.)
   — pontosan úgy ahogy egy rajzolt vagy fotó topón látszanának.

3. **Kötélhossz-információk**: Minden pitch-hez tartozó szöveges infó (fokozat,
   hossz, kulcsmozduatok, megjegyzések) elérhető egy al-nézetként — pl. lap gombbal
   váltható a topo és az infó nézet között.

4. **Több topo az órán**: Az órára szinkronizálható több topo (pl. 10), és a felhasználó
   workout indítás előtt vagy közben kiválasztja az aktuálisat.

5. **Topo-szerkesztő webapp**: Egy böngészős alkalmazás ahol a felhasználó:
   - Betölt egy topo képet (fotó vagy rajzolt)
   - Rárajzolja az útvonalat, jelöli az anchorokat, hozzáadja a sziklajellegzetességeket
   - Megadja a pitch-enkénti szöveges infókat
   - Az app legenerálja a digitális topo formátumot amit az óra megjelenít

6. **Szinkronizálás**: A webapp-ból az órára juttatás módja (USB deploy, cloud sync,
   vagy az app-ba csomagolás).

---

## Architektúra áttekintés

```
┌─────────────────────┐         ┌──────────────────────┐
│   Webapp (Editor)   │         │  Suunto Watch App    │
│                     │         │  (SuuntoPlus)        │
│  Topo kép betöltés  │         │                      │
│  Útvonal rajzolás   │  ───►   │  Topo renderelés     │
│  Anchor jelölés     │  JSON   │  Navigáció (tap/lap) │
│  Feature rajzolás   │  adat   │  Pitch info nézet    │
│  Pitch info szöveg  │         │  Topo választó       │
│  Export             │         │                      │
└─────────────────────┘         └──────────────────────┘
```

A watch app "buta megjelenítő" — a webapp végzi az összes intelligens munkát.
Az óra egy előre elkészített adat-csomagot kap és megjeleníti.

---

## Megvalósítási megközelítések

### A megoldás — Pre-renderelt kép csíkok (legbiztosabb)

**Koncepció**: A webapp a topo-t felszeleteli az útvonal mentén, és minden szelet
egy optimalizált kép (PNG). Az óra csak képeket jelenít meg és lépked köztük.

**Hogyan működik**:
1. A webapp-ban a user megrajzolja az útvonalat a topo képen
2. Az export során a webapp az útvonal mentén "szeleteket" vág:
   - Minden szelet = egy anchor-központú kivágás a topo-ból
   - Méret: 466×466 px (a kijelző méretére optimalizálva)
   - Egymást átfedő szeletek a folytonosság érdekében
3. Az óra a szeleteket egymás után jeleníti meg
4. Navigáció: tap = következő szelet, doubleTap = előző

**Topo adatformátum**:
```
topo/
  manifest.json        — topo metaadatok, pitch infók
  slice_01.png         — anchor 1 környéke
  slice_02.png         — anchor 2 környéke
  ...
```

**Előnyök**:
- Ha a SuuntoPlus tud képet megjeleníteni, ez biztosan működik
- A sziklajellegzetességek automatikusan megvannak (a képből jönnek)
- A webapp export egyszerű (canvas crop)
- Vizuálisan a leggazdagabb — az eredeti topo jelenik meg

**Hátrányok**:
- Függ az image renderelés megerősítésétől
- Memória limit: ~200KB-os jelzés a community-től — egy topo 5-10 szelettel
  könnyen túllépheti, ha a PNG-k nem elég agresszívan tömörítettek
- Diszkrét ugrások a szeletek között (nincs smooth panning)
- A szeletek fix zoom-szinten vannak — nem zoomolható

**Kockázat**: KÖZEPES — a kép renderelés nem megerősített

---

### B megoldás — Vektor-alapú egyetlen nézet, viewport eltolással (lehetséges)

**Koncepció**: A webapp a topo-t vektor formátumba konvertálja (CSS-pozicionált HTML
elemek). Az egész topo egyetlen nagy HTML layout, az óra egy "viewport ablakot" mozgat
rajta anchor-ról anchor-ra.

**Hogyan működik**:
1. A webapp-ban a user betölti a topo képet és rárajzolja:
   - Útvonal vonala (polyline koordináták)
   - Anchor pontok (pozíció + pitch infó)
   - Sziklajellegzetességek (kontúr vonalak, szimbólumok, jelölések)
2. Az export egy JSON fájlt generál az összes elem koordinátáival és stílusával
3. Az óra watch app betölti a JSON-t és HTML elemekként rendereli
4. Navigációkor `setStyle()` tolja el az egész layout-ot hogy az aktuális anchor
   a képernyő közepére kerüljön

**Topo adatformátum**:
```json
{
  "name": "Tupá, SZ stena, Tupa Bleda",
  "anchors": [
    {
      "id": 1,
      "x": 230, "y": 1800,
      "grade": "II.",
      "info": "Könnyű repedés mentén egyenesen fel..."
    },
    {
      "id": 2,
      "x": 245, "y": 1500,
      "grade": "III.",
      "info": "Jobbra a párkányon át..."
    }
  ],
  "route": [
    {"x": 230, "y": 2000},
    {"x": 230, "y": 1800},
    {"x": 245, "y": 1500},
    {"x": 260, "y": 1100}
  ],
  "features": [
    {"type": "crack", "points": [...]},
    {"type": "overhang", "points": [...]},
    {"type": "ledge", "points": [...]},
    {"type": "contour", "points": [...]}
  ]
}
```

**Óra-oldali renderelés**:
```html
<uiView>
  <div id="viewport" style="width:466px;height:466px;overflow:hidden;">
    <div id="topo-canvas" style="position:relative;width:1000px;height:3000px;">
      <!-- route line -->
      <div class="route-segment" style="..."></div>
      <!-- anchors -->
      <div class="anchor" style="left:230px;top:1800px;">●</div>
      <!-- features -->
      <div class="crack" style="..."></div>
      ...
    </div>
  </div>
</uiView>
```

Navigáció: `setStyle('#topo-canvas', 'top', '-1567px')` — az anchor pozíciójához igazítva.

**Előnyök**:
- Nem függ képmegjelenítéstől — tisztán HTML/CSS
- Kis fájlméret (JSON koordináták, nem pixelek)
- Skálázható bármilyen kijelzőre
- Folyamatos élmény — kontextus a szomszédos pitch-ek között
- Dinamikusan kiemelhető az aktuális anchor/pitch

**Hátrányok**:
- Függ a `setStyle()` + pozíció-eltolás működésétől
- `overflow:hidden` CSS support nem megerősített
- Sok HTML elem (komplex topo = sok feature div) → teljesítmény kérdéses
- A sziklajellegzetességek rajzolása a webapp-ban bonyolultabb fejlesztés
- A vektor rajz vizuálisan szegényebb mint az eredeti topo kép

**Kockázat**: KÖZEPES — a CSS viewport-eltolás nem megerősített

---

### C megoldás — Webapp pre-rendereli a topót, óra megjeleníti (ideális)

**Koncepció**: A webapp az okos rész — a user ott megrajzolja a topót, és a webapp
legenerálja belőle a **kész HTML/CSS-t** (vagy akár egy renderelt képet) amit az óra
csak megjelenít. Az óra nem értelmez JSON-t, nem épít fel layout-ot — kap egy kész
vizuális csomagot.

**Hogyan működik**:
1. Webapp-ban a user betölti a képet, rárajzol mindent (mint B-nél)
2. Az export NEM JSON koordináták, hanem:
   - **Opció C1 (HTML export)**: Kész HTML fájlok, pitch-enként vagy folyamatosan,
     minden CSS inline-ban — az óra app csak betölti mint template-et
   - **Opció C2 (Kép export)**: A webapp canvas-ra rendereli a vektor topót és
     PNG-ként exportálja (mint A, de a forrás vektor rajz, nem fotó crop)
   - **Opció C3 (Hibrid)**: Kép háttér + vektor overlay az interaktív elemekhez
     (anchor kiemelés, aktuális pitch jelzés)
3. Az óra app egyszerű: betölti a kész anyagot, lépked a nézetek között

**Topo adat-csomag (C1 — HTML export)**:
```
topo_bleda/
  manifest.json        — metaadatok, pitch-ek listája, infó szövegek
  topo.html            — a teljes topo mint egyetlen HTML template
  (vagy pitch_01.html, pitch_02.html, ... ha szegmentált)
```

A `topo.html`-t a webapp generálja automatikusan a szerkesztő canvas-ból — a user
nem szerkeszti kézzel.

**Topo adat-csomag (C2 — Kép export)**:
```
topo_bleda/
  manifest.json
  overview.png         — teljes topo, alacsony felbontás (áttekintő)
  pitch_01.png         — anchor 1 környéke, 466×466, optimalizált
  pitch_02.png         — anchor 2 környéke
  ...
```

**Előnyök**:
- Az óra app a lehető legegyszerűbb (buta megjelenítő)
- A webapp-ban nincs megkötés — canvas API, SVG, bármi használható
- A vizuális minőség a webapp-ban dől el, nem az óra korlátaival
- C1 és C2 párhuzamosan fejleszthető — ami működik az órán, azt használjuk
- A sziklajellegzetességek ugyanolyan gazdagok lehetnek mint egy kézzel rajzolt topo

**Hátrányok**:
- C1: sok generált HTML — ha a watch HTML parser lassú, probléma lehet
- C2: ugyanaz a kép-renderelés kockázat mint A-nál
- A webapp fejlesztés komolyabb (drawing editor)
- A generált HTML/kép formátumot az óra korlátaihoz kell igazítani
  (amit csak teszteléssel tudunk meg)

**Kockázat**: ALACSONY az óra oldalon (egyszerű kód), KÖZEPES a webapp oldalon
(komolyabb fejlesztés)

---

## Összehasonlítás

| Szempont | A (Kép csíkok) | B (Vektor + viewport) | C (Pre-render) |
|---|---|---|---|
| Óra-oldali komplexitás | Alacsony | Magas | Alacsony |
| Webapp komplexitás | Alacsony | Közepes | Magas |
| Vizuális minőség | Legjobb (fotó) | Szegényebb | Jó–Legjobb |
| Memória használat | Magas (képek) | Alacsony (JSON) | Változó |
| Platform kockázat | Közepes (kép?) | Közepes (CSS?) | Alacsony |
| Sziklajellegzetességek | Automatikus | Kézi rajzolás | Kézi rajzolás |
| Skálázhatóság | Fix zoom | Rugalmas | Változó |

---

## Ajánlott stratégia

### Fázis 0 — Felderítés (1. hét)
> SuuntoPlus Editor telepítés + gyors tesztek

**Cél**: A kritikus ismeretlenek megválaszolása, mielőtt bármit is építünk.

Tesztelendő:
- [ ] **Kép megjelenítés**: tud-e az óra PNG-t renderelni egy HTML template-ben?
      (`<img>` tag, CSS background-image, stb.)
- [ ] **CSS viewport-eltolás**: működik-e a `setStyle()` + `top`/`left` eltolás?
      Működik-e `overflow:hidden`?
- [ ] **CSS transition**: animálható-e a pozícióváltás?
- [ ] **HTML elemek száma**: hány div-et bír el az óra mielőtt lassul?
- [ ] **Memória limit**: mekkora adat-csomagot bír el (képek + JSON)?
- [ ] **Crown scroll API**: van-e bármilyen módja a crown scroll események elkapásának
      az app-on belül?
- [ ] **Több template**: tud-e egy app több HTML template-et tartalmazni és váltani
      köztük (`getUserInterface()` dinamikus return)?

Ezek a tesztek egyszerű próba-app-okkal megválaszolhatóak, mindegyik pár soros kód.

### Fázis 1 — Prototípus (2-3. hét)
> Hardcoded topo az órán

A Fázis 0 eredményei alapján az A, B, vagy C megoldás közül a legjobbat választjuk.

- 1-2 példa topo az `example_topo/` mappából, kézzel konvertálva a választott
  formátumba
- Navigáció: tap/doubleTap/lap
- Pitch info al-nézet
- **Nincs webapp, nincs szinkronizálás** — minden hardcoded

### Fázis 2 — Topo választó + több topo (4. hét)
> Az app több topót kezel

- Topo-választó nézet az app-ban (lista a szinkronizált topókból)
- Manifest struktúra több topo-hoz
- Topo-csomag formátum véglegesítés

### Fázis 3 — Webapp editor (5-8. hét)
> A felhasználó maga készíti a topókat

- Webapp: topo kép betöltés
- Rajzoló felület: útvonal, anchorok, sziklajellegzetességek
- Pitch info szerkesztő
- Export a véglegesített topo-csomag formátumba
- Manuális deploy (letöltés → USB → órára másolás)

### Fázis 4 — Szinkronizálás (9+. hét)
> Webapp → Óra automatikus szinkronizálás

Lehetséges megoldások (kutatás szükséges):
- SuuntoPlus app rebuild az új topókkal → redeploy
- Suunto Cloud API-n keresztül (ha van ilyen lehetőség)
- Bluetooth-on keresztül a webapp-ból közvetlenül (valószínűtlen)
- QR kód / deep link az óra app-hoz (kreatív megoldás)

---

## Bottleneck analízis

### 1. Fókusz mozgatása (anchor-ról anchor-ra navigáció)

| Kérdés | Státusz |
|---|---|
| Működik-e `setStyle()` pozíció-eltolásra? | Tesztelendő (Fázis 0) |
| Támogatja-e az óra az `overflow:hidden`-t? | Tesztelendő (Fázis 0) |
| Van-e CSS transition support? | Tesztelendő (Fázis 0) |

**Fallback**: Ha a viewport-eltolás nem működik → szegmentált nézetek (A megoldás).
Ha kép renderelés igen → pre-renderelt szelet képek.

### 2. Topo renderelés

| Kérdés | Státusz |
|---|---|
| PNG/kép megjelenítés HTML-ben? | Tesztelendő (Fázis 0) |
| Hány HTML elem bír el az óra? | Tesztelendő (Fázis 0) |
| Maximális adat-csomag méret? | Tesztelendő (Fázis 0) |

**Fallback**: Ha sem kép, sem sok div nem működik → extrém egyszerűsítés: csak
vonal + anchor + grade szöveg, minimális feature-ökkel.

### 3. Szöveges infó megjelenítése

| Kérdés | Státusz |
|---|---|
| Tud-e az app nézetet váltani? | Valószínűleg igen (`getUserInterface()`) |
| `onLap()` megbízhatóan működik? | Megerősített |

**Terv**: `onLap()` → `getUserInterface()` visszaad másik template-et (infó nézet)
→ `onLap()` újra → vissza a topo nézetre.

**Fallback**: Ha template-váltás nem működik → az infó szöveg a topo nézet alján/tetején
jelenik meg, overlay-ként.

### 4. Adat fájlok létrehozása

**Fázis 1**: Kézzel készített JSON/HTML — nem bottleneck, csak munkaidő.

**Fázis 3**: Webapp editor — ez a legnagyobb fejlesztési munka, de nincs platform
kockázat (standard web tech). A bottleneck itt nem technológiai, hanem UX:
- Hogyan legyen kényelmes a rajzolás mobil eszközön is?
- Milyen sziklajellegzetesség-szimbólumok kellenek?
- Milyen legyen az export formátum?

### 5. Topo kiválasztás az órán

| Kérdés | Státusz |
|---|---|
| Dinamikus template-váltás? | Tesztelendő (Fázis 0) |
| Lista nézet a topókból? | Megoldható HTML template-ként |

**Terv**: Az app induláskor egy lista-nézetet mutat a szinkronizált topók neveivel.
Tap-pel választ a user, utána indul a topo nézet.

**Fallback**: Ha nincs dinamikus váltás → minden topo külön SuuntoPlus app-ként
deploy-olva (csúnya de működik).

### 6. Szinkronizálás (webapp → óra)

Ez a legnagyobb nyitott kérdés hosszú távon.

| Opció | Megvalósíthatóság |
|---|---|
| App rebuild + USB redeploy | Biztosan működik, de kényelmetlen |
| Suunto Cloud API | Nem egyértelmű hogy SuuntoPlus app adatot tud-e küldeni |
| Companion phone app | Komoly extra fejlesztés |
| Fájl másolás USB-n | Működhet ha az app fájlrendszerből tud olvasni |

**Fázis 1-2**: Manuális (app-ba csomagolva, USB deploy). Elfogadható prototípushoz.
**Fázis 4**: Kutatás a jobb megoldásokra az akkor ismert platform lehetőségek alapján.

---

## Suunto API kutatás eredményei

A Suunto ökoszisztéma két különálló rendszert kínál, amelyek relevánsak a projekthez:

### SuuntoPlus Sports Apps (ELSŐDLEGES — custom watch app)

A SUUNTOPO fő megvalósítási platformja. Teljes custom UI lehetőség.

**Megerősített képességek**:
- Custom HTML/CSS/JS templates a kijelzőn
- Touch events: `onTap`, `onDoubleTap`, `onLongTapStart`
- Button callback: `onLap(input, output)`, `onAutoLap(input, output)`
- Dynamic styling: `setStyle(selector, property, value)`
- Template kiválasztás: `getUserInterface()` → `{template: 'name'}`
- System callbacks: `evaluate(data)`, `onLoad()`
- Persistent storage: értékek megmaradnak workout-ok között
- Settings (`data.json`): a Suunto mobil app "My Apps" nézetéből konfigurálható,
  automatikusan szinkronizálódik az órára
- Build process: HTML + kép fájlok konvertálása óra-kompatibilis formátumba
- Deployment: USB vagy Bluetooth a SuuntoPlus Editor-ból (VS Code extension)
- Max 15 app az órán

**Nem megerősített / tesztelendő**:
- Kép renderelés (PNG, `<img>`, CSS background-image)
- CSS overflow, position, transform support
- CSS transition / animation
- HTML elem számkorlát
- Memória / csomag méret limit
- Crown scroll event elkapás
- `data.json` méret limit és struktúra rugalmassága

**Adattárolás lehetőségei**:
1. **App-ba csomagolt fájlok**: manifest-ben hivatkozott HTML/JS + képek.
   A build process konvertálja ezeket. Topo adatok ide csomagolhatók.
2. **`data.json` settings**: A Suunto mobil app-ból konfigurálható, auto-sync
   az órára. Potenciálisan topo adat tárolható itt, de a méret limit ismeretlen.
3. **Persistent storage**: JS API-ból írható/olvasható, workout-ok között megmarad.
   Funkció nevek nem dokumentáltak publikusan — tesztelendő a SuuntoPlus Editor-ban.

### SuuntoPlus Guides (MÁSODLAGOS — cloud sync + szöveges infó)

Strukturált workout tartalom, cloud sync-kel. Nem alkalmas vizuális topo
megjelenítésre, de hasznos lehet kiegészítő szöveges infóhoz vagy hosszú távon
a szinkronizálási probléma megoldásához.

**Képességek**:
- Cloud sync: Webapp → Cloud API → Suunto Mobile App → Watch (automatikus!)
- ZIP formátum: `manifest.json` + `guide.json` + `icon.png` (300×300 px)
- Steps rendszer: max 1000 step, `manualLap` transition (gomb navigáció)
- `text` mező: max 54 karakter, 6 sor `\n`-nel
- Route navigation: GPS waypoints, on-route tolerance
- Notifications: rövid szöveges popup (20 mp)
- Predefined field types: heartRate, speed, altitude, distance, stb.

**Cloud API**:
```
POST   cloudapi.suunto.com/v2/guides/files      — guide feltöltés (ZIP)
PUT    cloudapi.suunto.com/v2/guides/files/{id}  — guide frissítés
GET    cloudapi.suunto.com/v2/guides/items       — listázás
GET    cloudapi.suunto.com/v2/guides/files/{id}  — letöltés (ZIP)
DELETE cloudapi.suunto.com/v2/guides/files/{id}  — törlés
```
Auth: `Authorization` + `Ocp-Apim-Subscription-Key` headers.

**Korlátozások**:
- NEM tud custom HTML/grafika megjelenítést — fix layout, predefined mezők
- A step-ek megjelenítése a Suunto OS által renderelt data field layout
- Csak workout közben érhető el

**Lehetséges felhasználás a SUUNTOPO-ban**:
- Szöveges pitch infó (grade, leírás) mint Guide steps → cloud sync-kel
  szinkronizálva az órára, a vizuális topo mellé kiegészítésként
- Topo metadata szinkronizálás (nevek, pitch listák) ha a Sports App
  `data.json` méret limit szűkös

### Prioritási sorrend

1. **Sports App** a fő platform — itt épül a vizuális topo megjelenítő
2. A **szinkronizálás egyelőre másodlagos** — manuális deploy (USB) elfogadható
3. A Guides API később jöhet szóba:
   - Ha a `data.json` méret limit problémás → Guides mint adat csatorna
   - Ha szöveges pitch infó kell cloud sync-kel
   - Ha a Sports App persistent storage nem elég rugalmas

---

## Nyitott kérdések

1. Milyen fájlformátumokat tud a SuuntoPlus app a saját csomagjából olvasni?
   (Csak a manifest-ben hivatkozott HTML/JS, vagy tetszőleges fájl is?)
2. Van-e SuuntoPlus app-ok közötti adat-megosztás vagy shared storage?
3. A SuuntoPlus Editor beépített példái (pl. "climbing tracker") mit csinálnak
   pontosan? Van-e bennük kép vagy komplex UI?
4. A `data.json` mekkora lehet, és milyen struktúrát támogat?
   (Ha elég nagy és rugalmas → topo adat szinkronizálás a Suunto mobil app-on
   keresztül, webapp nélkül is.)
5. A persistent storage JS API-ja milyen műveleteket támogat?
   (store/retrieve/delete, méret limit, adattípusok)
