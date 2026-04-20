# Patchs CSP — QR Codes externes

## Option A (recommandée) : Générer les QR codes localement

```bash
cd /Users/reunion/eM@g && npm install qrcode --save
```

Puis remplacer les `<img src="https://api.qrserver.com/...">` par un composant local.

Fichiers à modifier :
- `apps/web/src/components/equipment/EquipmentBatchLabels.jsx:149`
- `apps/web/src/components/equipment/EquipmentLabelPrint.jsx:153`  
- `apps/web/src/components/equipment/EquipmentSheetPrint.jsx:157`

Exemple de remplacement (dans un print HTML) :
```js
import QRCode from 'qrcode';

// Générer un data URL au lieu d'une URL externe
const qrDataUrl = await QRCode.toDataURL(url, { width: 200, margin: 1 });
// Utiliser : <img src="${qrDataUrl}" />
```

## Option B (rapide mais moins sécurisée) : Whitelister le domaine

### Vite preview (vite.config.js)
```diff
- "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com",
+ "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://api.qrserver.com",
```

### Helmet backend (apps/api/config/helmet.js)
```diff
- imgSrc: ["'self'", 'data:', 'blob:'],
+ imgSrc: ["'self'", 'data:', 'blob:', 'https://api.qrserver.com'],
```

⚠️ L'option B expose les utilisateurs à un service tiers (goqr.me) sans contrôle.
   L'option A est plus sûre et fonctionne offline.
