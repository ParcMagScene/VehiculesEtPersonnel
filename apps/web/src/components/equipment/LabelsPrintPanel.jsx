/* eslint-disable react-hooks/exhaustive-deps */
import './LabelsPrintPanel.css';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, EmptyState, SearchBar, Spinner } from '@/design-system';
import { api } from '@/utils/api';
import { MAG_NUMBER_RE } from '@/utils/magNumber';

const PAGE_SIZE = 50;
// Capacité d'UNE plaque LightBurn (4 colonnes × 8 lignes = 32 étiquettes).
// Si la sélection dépasse 32, la génération produit plusieurs plaques.
const PER_PLATE = 32;
// LETTRES + CHIFFRES (ex VX1, E09, T01). Source : utils/magNumber.js.
const MAG_REGEX = MAG_NUMBER_RE;
// Plaque 200×200 mm → en pixels à 300 DPI = 200/25.4 * 300 ≈ 2362 px
const PNG_PX = Math.round((200 / 25.4) * 300);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function svgBlobToPngBlob(svgBlob, sizePx = PNG_PX) {
  const svgText = await svgBlob.text();
  // Inline le SVG en data URL pour éviter taint canvas
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Échec du rendu SVG → image'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  // Fond blanc explicite (évite transparence dans l'aperçu utilisateur)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sizePx, sizePx);
  ctx.drawImage(img, 0, 0, sizePx, sizePx);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob a échoué'))), 'image/png'),
  );
}

export default function LabelsPrintPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [withoutMag, setWithoutMag] = useState(false);
  const [page, setPage] = useState(1);

  // selection : Map<serial_id, item> conservé indépendamment du filtre/recherche.
  // Permet d'empiler des items de références différentes (ex : 36 VIPER + 22 MEGAPOINTE)
  // et de les retrouver dans le panier même après changement de filtre.
  const [selection, setSelection] = useState(() => new Map());
  const [magEdits, setMagEdits] = useState({}); // { id: { value, status: 'idle'|'saving'|'saved'|'error' } }

  // plates : tableau de plaques générées. Chaque plaque = { blob, url } où url
  // est un object URL pour l'iframe d'aperçu. Reset à chaque nouvelle génération.
  const [plates, setPlates] = useState([]);
  const [plateIndex, setPlateIndex] = useState(0);
  const [generating, setGenerating] = useState(false);

  // ─── Chargement liste ───
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSerializedLabels({
        search: search || undefined,
        withoutMag: withoutMag || undefined,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPage(1);
    } catch (e) {
      setError(e.message || 'Erreur de chargement');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, withoutMag]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ─── Pagination ───
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [items, page],
  );

  // ─── Sélection ───
  // Pas de cap : si la sélection dépasse PER_PLATE, on génère plusieurs plaques.
  const toggleOne = (item) => {
    const id = typeof item === 'object' ? item.serial_id : item;
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Si on n'a que l'id (retiré depuis le panier d'un item disparu du filtre),
        // on retombe sur l'objet courant si présent dans items.
        const obj =
          typeof item === 'object'
            ? item
            : items.find((i) => i.serial_id === id) || { serial_id: id };
        next.set(id, obj);
      }
      return next;
    });
  };
  const togglePage = () => {
    setSelection((prev) => {
      const next = new Map(prev);
      const allSelected = pageItems.every((it) => next.has(it.serial_id));
      if (allSelected) pageItems.forEach((it) => next.delete(it.serial_id));
      else pageItems.forEach((it) => next.set(it.serial_id, it));
      return next;
    });
  };
  const clearSelection = () => setSelection(new Map());

  // ─── Édition mag_number ───
  const onMagChange = (id, raw) => {
    const value = raw.toUpperCase();
    setMagEdits((prev) => ({ ...prev, [id]: { value, status: 'idle' } }));
  };
  const onMagBlur = async (id) => {
    const edit = magEdits[id];
    if (!edit) return;
    const original = items.find((i) => i.serial_id === id)?.mag_number || '';
    if (edit.value === original) return;
    if (edit.value && !MAG_REGEX.test(edit.value)) {
      setMagEdits((p) => ({ ...p, [id]: { ...edit, status: 'error' } }));
      return;
    }
    setMagEdits((p) => ({ ...p, [id]: { ...edit, status: 'saving' } }));
    try {
      const resp = await api.updateSerialMagNumber(id, edit.value || null);
      // Le backend renvoie aussi `serial` (potentiellement nettoyé du préfixe MAG).
      const nextSerial = resp && typeof resp.serial === 'string' ? resp.serial : null;
      setItems((prev) =>
        prev.map((it) =>
          it.serial_id === id
            ? {
                ...it,
                mag_number: edit.value || null,
                serial: nextSerial != null ? nextSerial : it.serial,
                // L'éventuelle suggestion devient caduque.
                suggested_mag: null,
                suggested_serial: null,
              }
            : it,
        ),
      );
      setMagEdits((p) => ({ ...p, [id]: { ...edit, status: 'saved' } }));
      // efface le badge "saved" après 2s
      setTimeout(() => {
        setMagEdits((p) => {
          const cur = p[id];
          if (cur && cur.status === 'saved') {
            const { [id]: _, ...rest } = p;
            return rest;
          }
          return p;
        });
      }, 2000);
    } catch (e) {
      setMagEdits((p) => ({ ...p, [id]: { ...edit, status: 'error' } }));
      setError(e.message);
    }
  };

  // ─── Génération plaque(s) ───
  // Découpe la sélection en lots de PER_PLATE et génère 1 plaque par lot.
  const generate = async () => {
    if (selection.size === 0) return;
    // Avertit si certains items ont déjà été imprimés.
    const alreadyPrinted = Array.from(selection.values()).filter((it) => (it.print_count || 0) > 0);
    if (alreadyPrinted.length > 0) {
      const sample = alreadyPrinted
        .slice(0, 8)
        .map(
          (it) =>
            `• ${it.equipment_name || `#${it.serial_id}`} (${it.mag_number || it.serial || ''})`,
        )
        .join('\n');
      const more = alreadyPrinted.length > 8 ? `\n… +${alreadyPrinted.length - 8} autre(s)` : '';
      const ok = window.confirm(
        `${alreadyPrinted.length} équipement(s) de la sélection ont déjà été imprimés au moins une fois :\n\n${sample}${more}\n\nGénérer quand même ?`,
      );
      if (!ok) return;
    }
    setGenerating(true);
    setError(null);
    // Révoque les anciens object URLs avant de remplacer.
    plates.forEach((p) => URL.revokeObjectURL(p.url));
    setPlates([]);
    setPlateIndex(0);
    try {
      // Ordre = ordre d'insertion dans le Map = ordre de sélection utilisateur.
      const allIds = Array.from(selection.keys());
      const chunks = [];
      for (let i = 0; i < allIds.length; i += PER_PLATE) {
        chunks.push(allIds.slice(i, i + PER_PLATE));
      }
      const stamp = Date.now();
      const next = [];
      for (let k = 0; k < chunks.length; k++) {
        const suffix = chunks.length > 1 ? `-${k + 1}-sur-${chunks.length}` : '';
        const filename = `plaque-etiquettes-${stamp}${suffix}.svg`;
        // eslint-disable-next-line no-await-in-loop
        const blob = await api.generateLabelsPlate(chunks[k], filename);
        next.push({ blob, url: URL.createObjectURL(blob) });
      }
      setPlates(next);
      // Rafraîchit la liste pour mettre à jour print_count / last_printed_at.
      reload();
    } catch (e) {
      setError(e.message || 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  const downloadSvg = () => {
    if (plates.length === 0) return;
    const stamp = Date.now();
    plates.forEach((p, i) => {
      const suffix = plates.length > 1 ? `-${i + 1}-sur-${plates.length}` : '';
      downloadBlob(p.blob, `plaque-etiquettes-${stamp}${suffix}.svg`);
    });
  };
  const downloadPng = async () => {
    if (plates.length === 0) return;
    setError(null);
    try {
      const stamp = Date.now();
      for (let i = 0; i < plates.length; i++) {
        const suffix = plates.length > 1 ? `-${i + 1}-sur-${plates.length}` : '';
        // eslint-disable-next-line no-await-in-loop
        const png = await svgBlobToPngBlob(plates[i].blob);
        downloadBlob(png, `plaque-etiquettes-${stamp}${suffix}.png`);
      }
    } catch (e) {
      setError(`Conversion PNG échouée : ${e.message}`);
    }
  };

  // cleanup
  useEffect(
    () => () => {
      plates.forEach((p) => URL.revokeObjectURL(p.url));
    },
    [plates],
  );

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((it) => selection.has(it.serial_id));
  const plateCount = Math.max(1, Math.ceil(selection.size / PER_PLATE));

  // Synchronise les détails de la sélection avec les items rechargés :
  // print_count / last_printed_at / mag_number à jour après reload() ou save MAG.
  useEffect(() => {
    if (items.length === 0 || selection.size === 0) return;
    setSelection((prev) => {
      let mutated = false;
      const next = new Map(prev);
      for (const it of items) {
        if (next.has(it.serial_id)) {
          next.set(it.serial_id, it);
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [items]);

  // Liste ordonnée des items sélectionnés (ordre d'insertion préservé par Map).
  // Indépendant des filtres en cours : on voit tous les items du panier.
  const selectedItems = useMemo(() => Array.from(selection.values()), [selection]);
  const alreadyPrintedCount = selectedItems.filter((it) => (it.print_count || 0) > 0).length;

  const formatPrintedAt = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="lpp-container">
      <div className="lpp-toolbar">
        <div className="lpp-toolbar-left">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Rechercher (S/N, MAG, produit, UID)…"
            style={{ minWidth: 280 }}
          />
          <label className="lpp-filter-toggle">
            <input
              type="checkbox"
              checked={withoutMag}
              onChange={(e) => setWithoutMag(e.target.checked)}
            />
            Sans Numéro Mag
          </label>
        </div>
        <div className="lpp-toolbar-right">
          <span className="lpp-counter">
            {selection.size} sélectionné{selection.size > 1 ? 's' : ''}
            {selection.size > 0 &&
              ` — ${plateCount} plaque${plateCount > 1 ? 's' : ''} de ${PER_PLATE}`}
          </span>
          {selection.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Tout désélectionner
            </Button>
          )}
          <Button
            variant="primary"
            disabled={selection.size === 0 || generating}
            onClick={generate}
          >
            {generating
              ? 'Génération…'
              : `Générer ${plateCount} plaque${plateCount > 1 ? 's' : ''} (${selection.size})`}
          </Button>
        </div>
      </div>

      {error && <div className="lpp-error">{error}</div>}

      <div className="lpp-main">
        <div className="lpp-table-wrapper">
          {loading ? (
            <div className="lpp-loading">
              <Spinner /> Chargement…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Aucun numéro de série"
              description="Importez des données Locmat ou ajustez vos filtres."
            />
          ) : (
            <table className="lpp-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePage}
                      aria-label="Sélectionner la page"
                    />
                  </th>
                  <th>Produit</th>
                  <th>Référence</th>
                  <th>UID</th>
                  <th>S/N</th>
                  <th>Numéro Mag</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((it) => {
                  const checked = selection.has(it.serial_id);
                  const edit = magEdits[it.serial_id];
                  const magVal = edit ? edit.value : it.mag_number || '';
                  const hasSuggestion = !!it.suggested_mag && !it.mag_number && !edit;
                  const magCls = edit
                    ? edit.status === 'error'
                      ? 'lpp-mag-invalid'
                      : edit.status === 'saved'
                        ? 'lpp-mag-saved'
                        : ''
                    : hasSuggestion
                      ? 'lpp-mag-suggested'
                      : '';
                  const applySuggestion = () => {
                    onMagChange(it.serial_id, it.suggested_mag);
                    // Délai pour laisser le state se propager avant le PUT
                    setTimeout(() => onMagBlur(it.serial_id), 0);
                  };
                  return (
                    <tr key={it.serial_id} className={checked ? 'lpp-selected' : ''}>
                      <td>
                        <input type="checkbox" checked={checked} onChange={() => toggleOne(it)} />
                      </td>
                      <td>
                        {it.equipment_name}
                        {(it.print_count || 0) > 0 && (
                          <span
                            className="lpp-printed-badge"
                            title={`Déjà imprimé ${it.print_count}× (dernière : ${formatPrintedAt(it.last_printed_at)})`}
                          >
                            🖨 {it.print_count}×
                          </span>
                        )}
                      </td>
                      <td>{it.equipment_reference || '—'}</td>
                      <td>
                        <code style={{ fontSize: '0.8em' }}>
                          {it.serial_uid || it.equipment_uid || '—'}
                        </code>
                      </td>
                      <td>
                        <code>{it.serial}</code>
                        {hasSuggestion && (
                          <div className="lpp-suggested-hint" title="Détecté depuis le S/N">
                            → <code>{it.suggested_serial}</code>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="lpp-mag-cell">
                          <input
                            type="text"
                            className={`lpp-mag-input ${magCls}`}
                            value={magVal}
                            maxLength={5}
                            placeholder={hasSuggestion ? it.suggested_mag : 'A12'}
                            onChange={(e) => onMagChange(it.serial_id, e.target.value)}
                            onBlur={() => onMagBlur(it.serial_id)}
                          />
                          {hasSuggestion && (
                            <button
                              type="button"
                              className="lpp-mag-apply"
                              onClick={applySuggestion}
                              title={`Appliquer la suggestion : ${it.suggested_mag}`}
                            >
                              ✓ {it.suggested_mag}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <aside className="lpp-cart" aria-label="Sélection en cours">
          <div className="lpp-cart-header">
            <span>
              Sélection ({selection.size})
              {alreadyPrintedCount > 0 && (
                <span
                  className="lpp-printed-badge"
                  title={`${alreadyPrintedCount} déjà imprimé(s) au moins une fois`}
                >
                  ⚠ {alreadyPrintedCount} déjà imprimé{alreadyPrintedCount > 1 ? 's' : ''}
                </span>
              )}
            </span>
            {selection.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Vider
              </Button>
            )}
          </div>
          {selection.size === 0 ? (
            <div className="lpp-cart-empty">
              Cochez des équipements à gauche pour préparer une plaque.
            </div>
          ) : (
            <div className="lpp-cart-list">
              {selectedItems.map((it) => {
                const printed = (it.print_count || 0) > 0;
                return (
                  <div
                    key={`cart-${it.serial_id}`}
                    className={`lpp-cart-item${printed ? ' lpp-cart-printed' : ''}`}
                  >
                    <div className="lpp-cart-item-head">
                      <span className="lpp-cart-item-name" title={it.equipment_name}>
                        {it.equipment_name}
                      </span>
                      <button
                        type="button"
                        className="lpp-cart-item-remove"
                        onClick={() => toggleOne(it)}
                        aria-label={`Retirer ${it.equipment_name} de la sélection`}
                        title="Retirer de la sélection"
                      >
                        ×
                      </button>
                    </div>
                    <div className="lpp-cart-item-meta">
                      <span>{it.mag_number || '—'}</span>
                      <span>{it.serial}</span>
                    </div>
                    {printed && (
                      <div className="lpp-cart-item-printed">
                        Imprimé {it.print_count}× — dernière {formatPrintedAt(it.last_printed_at)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {totalPages > 1 && (
        <div className="lpp-pagination">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Précédent
          </Button>
          <span>
            Page {page} / {totalPages} ({items.length} entrées)
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant →
          </Button>
        </div>
      )}

      {plates.length > 0 && (
        <div className="lpp-preview">
          {plates.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                disabled={plateIndex <= 0}
                onClick={() => setPlateIndex((i) => Math.max(0, i - 1))}
              >
                ← Plaque précédente
              </Button>
              <span>
                Plaque {plateIndex + 1} / {plates.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={plateIndex >= plates.length - 1}
                onClick={() => setPlateIndex((i) => Math.min(plates.length - 1, i + 1))}
              >
                Plaque suivante →
              </Button>
            </div>
          )}
          <iframe
            src={plates[plateIndex].url}
            title={`Aperçu plaque étiquettes ${plateIndex + 1}/${plates.length}`}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={downloadSvg}>
              {plates.length > 1
                ? `Télécharger ${plates.length} SVG (LightBurn)`
                : 'Télécharger SVG (LightBurn)'}
            </Button>
            <Button variant="secondary" onClick={downloadPng}>
              {plates.length > 1
                ? `Télécharger ${plates.length} PNG 300 DPI`
                : 'Télécharger PNG 300 DPI'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
