/* eslint-disable react-hooks/exhaustive-deps */
import './LabelsPrintPanel.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, EmptyState, Input, SearchBar, Spinner } from '@/design-system';
import { api } from '@/utils/api';
import { MAG_NUMBER_RE } from '@/utils/magNumber';

const PAGE_SIZE = 50;
const MAX_PER_PLATE = 32;
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

  const [selected, setSelected] = useState(() => new Set());
  const [magEdits, setMagEdits] = useState({}); // { id: { value, status: 'idle'|'saving'|'saved'|'error' } }

  const [previewUrl, setPreviewUrl] = useState(null);
  const previewBlobRef = useRef(null);
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
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PER_PLATE) next.add(id);
      return next;
    });
  };
  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageItems.every((it) => next.has(it.serial_id));
      if (allSelected) {
        pageItems.forEach((it) => next.delete(it.serial_id));
      } else {
        for (const it of pageItems) {
          if (next.size >= MAX_PER_PLATE) break;
          next.add(it.serial_id);
        }
      }
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

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
      await api.updateSerialMagNumber(id, edit.value || null);
      setItems((prev) =>
        prev.map((it) => (it.serial_id === id ? { ...it, mag_number: edit.value || null } : it)),
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

  // ─── Génération plaque ───
  const generate = async () => {
    if (selected.size === 0) return;
    setGenerating(true);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    try {
      const ids = items
        .map((i) => i.serial_id)
        .filter((id) => selected.has(id))
        .slice(0, MAX_PER_PLATE);
      const blob = await api.generateLabelsPlate(ids);
      previewBlobRef.current = blob;
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e.message || 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  const downloadSvg = () => {
    if (!previewBlobRef.current) return;
    downloadBlob(previewBlobRef.current, `plaque-etiquettes-${Date.now()}.svg`);
  };
  const downloadPng = async () => {
    if (!previewBlobRef.current) return;
    setError(null);
    try {
      const png = await svgBlobToPngBlob(previewBlobRef.current);
      downloadBlob(png, `plaque-etiquettes-${Date.now()}.png`);
    } catch (e) {
      setError(`Conversion PNG échouée : ${e.message}`);
    }
  };

  // cleanup
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((it) => selected.has(it.serial_id));
  const selectionFull = selected.size >= MAX_PER_PLATE;

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
            <Input
              type="checkbox"
              checked={withoutMag}
              onChange={(e) => setWithoutMag(e.target.checked)}
            />
            Sans Numéro Mag
          </label>
        </div>
        <div className="lpp-toolbar-right">
          <span className={`lpp-counter ${selectionFull ? 'lpp-counter-warn' : ''}`}>
            {selected.size} / {MAX_PER_PLATE} sélectionnés
          </span>
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Tout désélectionner
            </Button>
          )}
          <Button variant="primary" disabled={selected.size === 0 || generating} onClick={generate}>
            {generating ? 'Génération…' : `Générer plaque (${selected.size})`}
          </Button>
        </div>
      </div>

      {error && <div className="lpp-error">{error}</div>}

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
                  <Input
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
                const checked = selected.has(it.serial_id);
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
                      <Input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(it.serial_id)}
                        disabled={!checked && selectionFull}
                      />
                    </td>
                    <td>{it.equipment_name}</td>
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
                        <Input
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

      {previewUrl && (
        <div className="lpp-preview">
          <iframe src={previewUrl} title="Aperçu plaque étiquettes" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={downloadSvg}>
              Télécharger SVG (LightBurn)
            </Button>
            <Button variant="secondary" onClick={downloadPng}>
              Télécharger PNG 300 DPI
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
