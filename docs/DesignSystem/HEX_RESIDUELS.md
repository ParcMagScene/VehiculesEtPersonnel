# Hex Résiduels Intentionnels — eM@g Design System

> **Phase 6.7** — Nettoyage hex résiduels  
> **Date** : 15 avril 2026  
> **Baseline** : ~510 hex bruts → **35 CSS + ~289 JSX = ~324 intentionnels documentés**

---

## Politique

Les valeurs hexadécimales ci-dessous sont **intentionnelles** et ne doivent PAS être converties en tokens CSS :

- **Couleurs Google brand** : `#ea4335` (red), `#4285f4` (blue) — imposées par charte Google
- **Couleurs TV alarme** : `#ff6600`, `#2ecc40` — vivides pour écran TV à distance
- **Couleurs d'impression** : inline `<style>` dans JSX — CSS variables non supportées en print
- **Couleurs SVG/Canvas** : attributs `stroke`/`fill` dans composants carte (Depot, Locations)
- **Couleurs domaine métier** : catégories BL, types de personnel, statuts réservation
- **Gradients décoratifs** : mobile, calendrier, QR

## Détail CSS (35 hex dans 17 fichiers)

### Google brand (14 occurrences)
- `TaskEditModal.css` : `#ea4335` (Google Red), `#4285f4` (Google Blue)
- `EventTaskModal.css` : `#4285f4` (Google Blue)
- `TaskPlanningPanel.css` : `#ea4335`, `#4285f4`
- `GoogleCalendarBanner.css` : `#fcc`, `#c33` (alerte sync)
- `GoogleCalendarConfig.css` : `#ea580c` (erreur config)

### TV / Display (4 occurrences)
- `DisplayDashboardPanel.css` : `#ff6600` (alarme), `#2ecc40` (sending)

### Domaine métier (10 occurrences)
- `PersonnelPanel.css` : `#ccfbf1`, `#0d9488` (badge apprenti × 2 sélecteurs)
- `PersonnelImportModal.css` : `#f472b6` (badge pink)
- `MobileAffaires.css` : `#fef9c3`, `#a16207` (statut pending)
- `LocationDialog.css` : `#34d399` (dark success × 2), `#7dd3fc` (info light)
- `BLBatchAnalysis.css` : `#fef2f210` (erreur bg alpha)

### Gradients / Décoratif (7 occurrences)
- `MobileEquipmentQR.css` : gradients #fafafe → #f0f0ff, #fbfefc → #f3fef7
- `MobileHome.css` : gradient #fce7f3 → #fbcfe8
- `MobilePlanning.css` : `#5568d3`
- `EventDetailsModal.css` : `#5a6fd6`
- `Calendar.css` : gradient #3b0764 → #581c87
- `EquipmentImportModal.css` : `#2d2b55` (print preview bg)
- `EquipmentPanel.css` : `#1a1a2e` (print preview bg)
- `LeaveRequestsPanel.css` : `#1e3a8a` (hover dark)

## JSX intentionnels (~289 occurrences)

Les hex en JSX sont dans :
- **Impressions** (~80) : `EquipmentSheetPrint`, `MapDualPrintModal`, `QRCodeModal`, `EquipmentBatchLabels`, `MobileAccess`, `MaintenanceReportModal`, `ReportsPanel`
- **Cartes SVG** (~50) : `DepotMap`, `DepotMapEditor`
- **Catégories BL** (~50) : `BLMultiImportModal`, `BLImportLocPrestaModal`
- **Google Calendar** (~20) : `GoogleCalendarBanner`, `ReservationModal`
- **Management** (~15) : `ManagementPanel`
- **Personnel** (~10) : `PersonnelPanel`
- **Autres** (~64) : badges, icônes, couleurs conditionnelles inline

---

## Résumé métriques

| Métrique | Avant Phase 6.7 | Après Phase 6.7 |
|----------|:--:|:--:|
| CSS hex bruts (hors thème, hors fallbacks) | 63 | 35 (tous intentionnels) |
| CSS fallbacks `var(--x, #hex)` | 164 | 164 (correct) |
| JSX hex inline | 289 | 289 (tous intentionnels) |
| **Non-intentionnels** | **~63** | **0** |
