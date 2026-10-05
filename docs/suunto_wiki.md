# Suunto Watch Hardware Reference for SUUNTOPO

This document collects hardware specs and input capabilities relevant to building
an interactive topo viewer as a SuuntoPlus Sports App.

## Display Specifications

| Watch              | Display  | Resolution    | Size  | Display ID | Notes                        |
|--------------------|----------|---------------|-------|------------|------------------------------|
| Suunto Race S      | AMOLED   | 466 × 466 px  | 1.32" | `q`        | Primary target               |
| Suunto Race        | AMOLED   | 466 × 466 px  | 1.43" | `q`        |                              |
| Suunto Race 2      | AMOLED LTPO | 466 × 466 px | 1.50" | `q`     | Up to 120 Hz refresh, 2000 nits |
| Suunto Vertical    | MIP      | 280 × 280 px  | 1.40" | `o`        | Memory-in-pixel, low power   |
| Suunto Vertical 2  | AMOLED LTPO | 466 × 466 px | 1.50" | `q`     | 2000 nits                    |
| Suunto Ocean       | AMOLED   | 466 × 466 px  | 1.43" | `q`        |                              |

### Older / Deprecated Displays

| Display ID | Resolution  | Watches           | Status           |
|------------|-------------|-------------------|------------------|
| `n`        | 240×240 px  | 9 Peak Pro        | UI v2            |
| `l`        | 320×300 px  | 9, 9 Baro         | UI v1, deprecated|
| `m`        | 240×240 px  | 5 Peak            | UI v1, deprecated|
| `s`        | 218×218 px  | 3, 5              | UI v1, deprecated|

### Key Takeaway for SUUNTOPO

- All AMOLED models share **466 × 466 px** (display ID `q`). Design for this.
- The circular display means usable area is smaller than a full 466 px square.
  Corners are clipped. Effective usable area is roughly a circle of ~466 px diameter.
- Display-specific templates possible via `"displays": ["q"]` in manifest.

## Physical Controls & Input

### Buttons

The Suunto Race S (and Race family) has **three physical buttons** plus a **touchscreen**:

| Button        | Position     | During Workout                          |
|---------------|------------- |-----------------------------------------|
| Upper button  | Top right    | Press: pause/resume. Long press: change activity |
| Crown (middle)| Middle right | Press: next display. Long press: previous display. **Scroll: navigate** |
| Lower button  | Bottom right | Press: mark lap. Long press: open control panel |

### SuuntoPlus pushButton System (MEGERŐSÍTETT)

A `<pushButton>` elem **5 fizikai gombot** tud kezelni, nem csak 2-t:

| Button name  | Position     | Megjegyzés |
|--------------|--------------|------------|
| `up`         | Upper right  | Elsődleges navigáció fel |
| `next`       | Middle right (crown press) | Crown gomb nyomás |
| `down`       | Lower right  | Elsődleges navigáció le |
| `upleft`     | Upper left   | Nem minden modellen elérhető |
| `downleft`   | Lower left   | Nem minden modellen elérhető |

### pushButton események

| Esemény | Trigger | Megjegyzés |
|---------|---------|------------|
| `onClick` | Nyomás ≤ 0.6s | Rövid kattintás |
| `onLongPressStart` | Nyomás > 0.6s | Hosszú nyomás kezdete |
| `onLongPress` | Hosszú nyomás befejezve | `longPressDuration` után (default 2s) |
| `onLongPressCancel` | Elengedés `longPressDuration` előtt | Félbehagyott long press |
| `onLongPressFull` | Továbbra is nyomva `longPressDuration` után | Tartott gomb |
| `onButtonEvent(target, targetData)` | Minden gombesemény előtt | Univerzális handler |

### onButtonEvent targetData értékek

| Érték | Esemény |
|-------|---------|
| 0 | LONG_START |
| 1 | LONG_CANCEL |
| 2 | LONG_FULL |
| 3 | LONG_PRESS |
| 4 | CLICK |
| 5 | FLICK_UP |
| 6 | FLICK_RIGHT |
| 7 | FLICK_DOWN |
| 8 | FLICK_LEFT |
| 9 | TWO_FINGER_TAP |
| 10 | DOUBLE_TAP |

### pushButton attribútumok

| Attribútum | Értékek | Default |
|------------|---------|---------|
| `type` | "normal", "action", "lock" | "normal" |
| `longType` | "default", "lock", "action" | — |
| `longPressDuration` | >0.6s (szám) | 2s |
| `enabledWhileDisplayOff` | true/false | false |
| `disabledWhileAOD` | true/false | false |
| `getIsEnabled` | JS kifejezés | — |

### Példa (teljes pushButton setup)

```html
<pushButton name="up"
  onClick="$.put('/Zapp/{zapp_index}/Event', 1, null, 'int32');"
  onLongPressStart="$.put('/Zapp/{zapp_index}/Event', 2, null, 'int32');" />
<pushButton name="down"
  onClick="$.put('/Zapp/{zapp_index}/Event', 3, null, 'int32');"
  onLongPressStart="$.put('/Zapp/{zapp_index}/Event', 4, null, 'int32');" />
```

```javascript
function onEvent(_input, output, eventId) {
  switch (eventId) {
    case 1: /* up click */ break;
    case 2: /* up long press */ break;
    case 3: /* down click */ break;
    case 4: /* down long press */ break;
  }
}
```

### Touch gesztusok

| Gesture      | Action                      | Akkumulátor hatás |
|--------------|-----------------------------|-------------------|
| Tap          | Select item                 | Magasabb fogyasztás |
| Swipe up/down | Navigate displays and menus| Magasabb fogyasztás |
| Swipe left/right | Move between displays   | Magasabb fogyasztás |
| `onTap`, `onDoubleTap`, `onLongTapStart` | HTML template események | Magasabb fogyasztás |

### Crown scroll

A crown scroll **valószínűleg NEM elérhető** az app számára — az OS használja
a display-ek közötti navigációhoz. A `<pushButton name="next">` a crown *nyomást*
kapja el, de a *tekerést* nem. pushButton up/down a megbízható navigációs input.

---

## Canvas API (MEGERŐSÍTETT)

A `<canvas>` elem teljes 2D drawing API-t biztosít:

### Metódusok

| Metódus | Leírás |
|---------|--------|
| `beginPath()` | Új path kezdése |
| `closePath()` | Path lezárása |
| `moveTo(x, y)` | Pozíció ugrás |
| `lineTo(x, y)` | Vonal húzás |
| `arc(x, y, r, startAngle, endAngle)` | Ív rajzolás |
| `arcTo(x1, y1, x2, y2, r)` | Ív két pont között |
| `stroke()` | Path körvonal rajzolás |
| `fill()` | Path kitöltés |
| `fillRect(x, y, w, h)` | Téglalap kitöltés |
| `fillText(text, x, y)` | Szöveg rajzolás |
| `measureText(text)` | Szöveg méret lekérdezés |
| `rotate(angle)` | Forgatás |
| `translate(x, y)` | Eltolás |
| `scale(x, y)` | Skálázás |
| `setTransform(a, b, c, d, e, f)` | Transform mátrix (6 paraméter) |

### Stílus tulajdonságok

| Tulajdonság | Megjegyzés |
|-------------|------------|
| `lineWidth` | Vonalvastagság |
| `strokeStyle` | Körvonal szín — **CSAK hexadecimális!** |
| `fillStyle` | Kitöltés szín — **CSAK hexadecimális!** |
| `lineCap` | Vonalvég stílus |
| `font` | Betűtípus |

### KRITIKUS: Szín formátum

**Kizárólag hexadecimális színek működnek!** Named colors NEM:
- `"#FFF"` — rgb rövid
- `"#FFFF"` — argb rövid
- `"#FFFFFF"` — rgb teljes
- `"#FFFFFFFF"` — argb teljes
- `"red"` — **NEM MŰKÖDIK!**
- `"rgb(255,0,0)"` — **NEM TESZTELT, valószínűleg NEM**

### KRITIKUS: Canvas frissítés

A canvas **nem frissül automatikusan** a rajzolás után! Manuálisan kell:

```javascript
control('#my-canvas', 'REFRESH');
```

Ez a `control(target, command)` függvény egyetlen ismert parancsa.

### Nem elérhető canvas funkciók

- Shadows (shadowBlur, shadowColor, stb.)
- Gradients (createLinearGradient, createRadialGradient)
- Patterns (createPattern)
- `transform()` — csak `setTransform()` működik

---

## Kép kezelés (MEGERŐSÍTETT)

### Korlátok

- **Max 2 kép per app**
- **Max 64 szín per kép**
- Csak PNG formátum

### Kép típusok

| Típus | Manifest `type` | Leírás |
|-------|-----------------|--------|
| Normál PNG | `"png"` | Teljes színes kép, max 64 szín |
| Alpha-only PNG | `"a64"` | Csak az alpha csatorna számít, szín CSS-ből jön |

### Alpha-only kép használata

```json
"image": [{ "name": "icon.png", "type": "a64" }]
```

```html
<img src="icon.png" style="color: #FF0000;" />
```

A szín a CSS `color` property-vel állítható → egy kép több színben is megjeleníthető!

---

## Nézet váltás (MEGERŐSÍTETT)

### Template váltás: `unload('_cm')`

```javascript
var currentTemplate = 't1';

var changeView = function(template) {
  currentTemplate = template;
  unload('_cm'); // '_cm' fix szintaxis — a SuuntoPlus nézet oldal
};

function getUserInterface() {
  return { template: currentTemplate };
}
```

### uiViewSet carousel

```html
<uiViewSet id="vs" orientation="horizontal"
  transition.type="crossfade" transition.duration="0.5"
  rollOver="both">
  <div class="selected">Első nézet (default)</div>
  <div>Második nézet</div>
  <div>Harmadik nézet</div>
</uiViewSet>
```

Navigáció JS-ből:
- `next('#vs')` — következő
- `previous('#vs')` — előző
- `first('#vs')` — első
- `last('#vs')` — utolsó
- `navigate('#vs', index, [immediate], [relative])` — ugrás index-re

Események:
- `onWakeUp` — animáció indult
- `onIdle` — animáció végzett
- `onSelectionChanged` — nézet váltott (`target` = div ID, `targetData` = index)

---

## Adattárolás

### localStorage (MEGERŐSÍTETT)

| Metódus | Leírás |
|---------|--------|
| `localStorage.setItem(key, value)` | String mentés |
| `localStorage.getItem(key)` | String olvasás (vagy null) |
| `localStorage.setObject(key, obj)` | Objektum mentés |
| `localStorage.getObject(key)` | Objektum olvasás (null ha string-ként mentett) |

Méret limit: nem dokumentált, de egyszerűség ajánlott.

### data.json settings

- Read-only az app JS-ből
- Suunto mobil app "My Apps" nézetéből konfigurálható
- Auto-sync az órára
- Minden string-ként tárolódik (int/float-ot JS-ben kell konvertálni)
- Nested path-ok támogatottak: `workout.AverageSpeed.actual`

Settings típusok a manifest-ben:
- `int` — egész szám (min/max, inputType: "slider")
- `float` — tizedes szám (min/max)
- `string` — szöveg (maxLength)
- `boolean` — true/false
- `enum` — felsorolás (values tömb)

---

## JavaScript környezet

### ES5 korlátok

- **Nincs** arrow function, const, let, template literal, destructuring
- **Nincs** Date object — használj `/Dev/Time` resource-t
- **Nincs** sessionStorage
- **Van**: Int8Array, Uint8Array, Float32Array

### Custom függvény deklaráció

```javascript
// TILOS (reserved for ESW/platform):
function myFunc() { }

// HELYES:
var myFunc = function() { }
```

A `function` kulcsszóval deklarált függvények a platform callbacks számára vannak
fenntartva (evaluate, onLoad, stb.).

### evalFile() — külső JS betöltés

```javascript
var loadExt = function(ix) {
  tmpFun = undefined; // Garbage collection
  return evalFile('{file_path}/ext' + ix + '.js');
};
var result = loadExt(1)(arg1, arg2);
```

Hasznos nagy topo adatok szétbontásához külön fájlokba!

### Memória kezelés

- **Stack memory** korlátozott betöltéskor → nagy kódot funkciókba szétbontani
- **Heap memory** korlátozott → typed array-ek overhead-dal járnak
- **Optimalizálás**: Egyetlen nagy Uint8Array jobb mint sok kis darab

```javascript
// ROSSZ — 256 + 2*N bytes overhead:
var buf_0 = new Uint8Array(128);
var buf_1 = new Uint8Array(128);

// JÓ — 256 + N bytes overhead:
var buffer = new Uint8Array(256);
```

### Memória hibák

| Hibaüzenet | Jelentés |
|------------|----------|
| `Zapp: releaseMemoryCb (exec. zapp)` | JS memória kimerült |
| `Zapp: releaseMemoryCb (exec. ui)` | HTML UI memória kimerült |
| `ERR APPLICATION : Zapp [name]: Exec. event x failed` | onEvent callback hiba |

---

## App limitek (összefoglalás)

| Limit | Érték |
|-------|-------|
| Max appok az órán | 15 |
| Max input resource-ok per app | 10 |
| Max output resource-ok per app | 25 |
| Max logged (naplózott) változók | 5 |
| Max summary outputok | ~4-5 (hard limit 8) |
| Max képek per app | 2 |
| Max szín per kép | 64 |
| evaluate() frekvencia | ~1/s (exercise előtt is!) |

---

## Hasznos extra API-k

### setText(selector, htmlContent)

```javascript
setText('#my-element', 'Új szöveg');
```

Dinamikus szöveg frissítés — az elemnek már kell szöveget tartalmaznia.

### setStyle(selector, property, value) / getStyle(selector, property)

```javascript
setStyle('#element', 'background-color', '#FF0000');
var color = getStyle('css:.c-green', 'color');
```

### playIndication(name, btn, prio, stop)

```javascript
playIndication('Confirm', true, 1, false);
```

Hangok: 'Button', 'Confirm', 'Info', 'Interval', 'StartTimer', 'StopTimer'

### Lap triggering

```javascript
$.put("/Activity/Trigger", 0);  // Normál lap (popup + notifikáció)
$.put("/Activity/Trigger", 23); // Silent lap (nincs popup/notifikáció)
$.put("/Activity/Trigger", 24); // Invisible lap (nincs popup, van notifikáció)
$.put("/Activity/Trigger", 25); // Muted lap (popup, nincs notifikáció)
```

### sportAppActivityEvent(activityId)

Multisport tevékenység váltás — pl. mászáshoz releváns activity ID-k léteznek.

### Compile-time tokenek

```javascript
if ('{{ DISPLAY_ID }}' == 'q') {
  // 466x466 specifikus kód
}
```

| Token | Leírás |
|-------|--------|
| `{{ DISPLAY_ID }}` | Display azonosító (q, o, n, stb.) |
| `{{ HAS_ON_EVENT }}` | 1 ha onEvent támogatott |
| `{{ HAS_SETTINGS }}` | 1 ha settings támogatott |
| `{{ IS_UI2 }}` | 1 ha UI v2 |
| `{{ LANGUAGE }}` | Nyelv kód (pl. "en") |

### Lokalizáció

Nyelvi fájlok: `en.json`, `hu.json`, stb. — HTML-ben `{{ identifier }}` helyettesítés.

---

## CSS rendszer

### Szín osztályok

| Osztály | Leírás |
|---------|--------|
| `cm-fg` | Előtér szín (téma-függő) |
| `cm-bg` | Háttér szín (téma-függő) |
| `cm-mid` | Szürke (téma-függő) |
| `sp-c-blue`, `sp-c-red`, stb. | Előtér színek |
| `sp-bc-blue`, `sp-bc-red`, stb. | Háttér színek |

### Pozicionálás

| Osztály | Leírás |
|---------|--------|
| `p-m` | Közép (vízszintes + függőleges) |
| `p-hc` | Vízszintes közép |
| `sp-vertical-center` | Gyerekek függőleges közepezése |

### e Szintaxis (elem méret referencia)

```css
left: calc(50% - 50%e);  /* Vízszintes közepezés */
top: calc(50% - 50%e);   /* Függőleges közepezés */
```

A `%e` a saját elem méretére hivatkozik.

### Betűméret osztályok (UI v2 — display `q`)

| Osztály | Méret |
|---------|-------|
| `sp-d-xxl` | Nagyon nagy szám |
| `sp-d-xl` | Nagy szám |
| `sp-d-l` | Közepes szám |
| `sp-d-m` | Kis szám |
| `sp-t-l` | Nagy szöveg |
| `sp-t-m` | Közepes szöveg |
| `sp-t-s` | Kis szöveg |
| `f-num` | Monospace szám font |
| `f-ico` | Ikon font |

---

## Build & Deploy

### Build folyamat

1. JS minifikálás (kommentek, whitespace, változónevek)
2. HTML és képek konvertálása óra-kompatibilis formátumba
3. Csomagolás tömörítetlen ZIP-be (`.fea` vagy `.dev`)

### Build optimalizálás

- Rövid fájlnevek: `t.html` nem `topo-view-template.html`
- Display-specifikus fájlok kihagyása: manifest `displays` property
- Külső JS fájlok: `ext0.js`, `ext1.js` — `evalFile()`-lal betölthetők
- Ez lehetővé teszi **topo adat fájlok külön tárolását**!

### Deploy

- USB: SuuntoPlus Editor VS Code extension
- Bluetooth: SuuntoPlus Editor VS Code extension

### Figyelmeztetések

- Suunto mobil app szinkronizálás **eltávolíthatja a dev appot** → unpair fejlesztés közben
- SuuntoLink ütközhet az Editor-ral → close + disable auto-start
- HTML preview nem mindig egyezik az óra kijelzővel (font rendering különbségek)

---

## Manifest teljes séma

### Kötelező mezők

| Mező | Típus | Korlát |
|------|-------|--------|
| `name` | String | Max 60 byte |
| `version` | String | Max 4 karakter |
| `author` | String | — |
| `description` | String | Max 100 byte |
| `type` | String | "device" vagy "feature" |
| `usage` | String | "workout" |
| `modificationTime` | Integer | Unix timestamp (1970 epoch) |

### Opcionális mezők

| Mező | Típus | Korlát |
|------|-------|--------|
| `in` | Array | Max 10 input resource |
| `out` | Array | Max 25 output (max 5 logged) |
| `template` | Array | HTML template fájlok |
| `image` | Array | Max 2 kép |
| `variables` | Array | Suunto app-ban megjelenő változók |
| `settings` | Array | Suunto app-ból állítható beállítások |

---

## Sources

- [Suunto Race S — Touch screen and buttons](https://www.suunto.com/Support/Product-support/suunto_race_s/suunto_race_s/getting-started/touch-screen-and-buttons/)
- [Suunto Race S specs — devicesfaq.com](https://www.devicesfaq.com/en/characteristics/suunto-race-s)
- [Suunto Race 2 review — DC Rainmaker](https://www.dcrainmaker.com/2025/08/suunto-race-2-in-depth-review-finally-accurate.html)
- [Suunto Vertical 2 vs Vertical — suunto.com](https://us.suunto.com/blogs/blog/suunto-vertical-vs-vertical-2)
- [Suunto Vertical specs — manua.ls](https://www.manua.ls/suunto/vertical/specifications)
- [SuuntoPlus Editor — API Zone](https://apizone.suunto.com/suuntoplusEditor)
- [SuuntoPlus Editor — VS Marketplace](https://marketplace.visualstudio.com/items?itemName=Suunto.suuntoplus-editor)
- [Suunto Community Forum](https://forum.suunto.com/topic/14783/question-no-stupid-questions-ask-anything-here)
- SuuntoPlus Editor v1.42.0 beépített developer reference (`developer-doc/reference.html`)
