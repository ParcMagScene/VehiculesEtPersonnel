import { readFileSync, writeFileSync } from 'fs';

const path = '/Users/reunion/eM@g/apps/web/src/components/planning/TaskEditModal.jsx';
let src = readFileSync(path, 'utf8');

// ── Step 1: add GitMerge to lucide import ──────────────────────────────────
src = src.replace(
  '  FileText,\n  Link2,',
  '  FileText,\n  GitMerge,\n  Link2,',
);
console.log('Step 1 ok (GitMerge import)');

// ── Step 2: replace cleanCourseTitle with initTitle ───────────────────────
const oldFn = `// Sections aliasées vers "courses"
const COURSE_SECTIONS = new Set(['courses', 'enlevement', 'retour', 'recuperation']);

// Nettoyer le titre d'une tâche courses : retirer emoji + préfixe type (Livraison, Récupération, etc.)
const cleanCourseTitle = (title, section) => {
  if (!title || !COURSE_SECTIONS.has(section)) return title || '';
  return (
    title
      // eslint-disable-next-line no-misleading-character-class
      .replace(
        /^[\\p{Emoji}\\p{Emoji_Presentation}\\p{Emoji_Modifier_Base}\\p{Emoji_Component}\\u200d\\ufe0f]+\\s*/u,
        '',
      )
      .replace(
        /^(Livraison|R(?:e|é)cup(?:e|é)ration|Recuperation|Enl(?:e|è)vement|Enlevement|Retour)\\s*—?\\s*/i,
        '',
      )
      .trim() || title
  );
};`;

const newFn = `// Sections aliasées vers "courses"
const COURSE_SECTIONS = new Set(['courses', 'enlevement', 'retour', 'recuperation']);

// Initialise le titre dans la modale d'édition :
// retire emoji + préfixe opérationnel + suffixe " — googleEventTitle" pour toutes les sections.
const initTitle = (task) => {
  const raw = task.title || '';
  const googleTitle = task.googleEventTitle || task.google_event_title || '';

  // 1. Retirer le préfixe emoji
  // eslint-disable-next-line no-misleading-character-class
  let t = raw
    .replace(
      /^[\\p{Emoji}\\p{Emoji_Presentation}\\p{Emoji_Modifier_Base}\\p{Emoji_Component}\\u200d\\ufe0f]+\\s*/u,
      '',
    )
    .trim();

  // 2. Retirer le label de section opérationnel
  t = t
    .replace(
      /^(Livraison|R(?:e|é)cup(?:e|é)ration|Recuperation|Enl(?:e|è)vement|Enlevement|Retour|Pr(?:e|é)paration|Preparation|Chargement|D(?:e|é)part|Installation|Montage|D(?:e|é)montage|Demontage|Intervention)\\s*[—–\\-:]?\\s*/iu,
      '',
    )
    .trim();

  // 3. Retirer le suffixe " — googleEventTitle" si identique
  if (googleTitle) {
    const sep = ' — ';
    const idx = t.indexOf(sep);
    if (idx >= 0) {
      const suffix = t.slice(idx + sep.length).trim();
      if (suffix.toLowerCase() === googleTitle.trim().toLowerCase()) {
        t = t.slice(0, idx).trim();
      }
    }
  }

  return t || raw;
};`;

if (!src.includes(oldFn)) { console.error('FAIL Step 2: cleanCourseTitle block not found'); process.exit(1); }
src = src.replace(oldFn, newFn);
console.log('Step 2 ok (initTitle function)');

// ── Step 3: add merge states + fix initial useState ───────────────────────
const oldState = `  const [form, setForm] = useState({
    title: cleanCourseTitle(task.title, task.section) || '',`;

const newState = `  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState([]);
  const [mergeLoadingState, setMergeLoadingState] = useState(false);
  const [merging, setMerging] = useState(false);

  const [form, setForm] = useState({
    title: initTitle(task),`;

if (!src.includes(oldState)) { console.error('FAIL Step 3: old useState not found'); process.exit(1); }
src = src.replace(oldState, newState);
console.log('Step 3 ok (merge states + useState)');

// ── Step 4: fix sync useEffect ────────────────────────────────────────────
const oldEffect = `  // Sync if task changes
  useEffect(() => {
    setForm({
      title: cleanCourseTitle(task.title, task.section) || '',`;

const newEffect = `  // Sync if task changes
  useEffect(() => {
    setMergeOpen(false);
    setMergeCandidates([]);
    setForm({
      title: initTitle(task),`;

if (!src.includes(oldEffect)) { console.error('FAIL Step 4: old useEffect not found'); process.exit(1); }
src = src.replace(oldEffect, newEffect);
console.log('Step 4 ok (sync useEffect)');

// ── Step 5: handleSave title fallback ─────────────────────────────────────
const oldSave = `        : '';
      await api.updateTask(task.id, {
        title: finalTitle,`;
const newSave = `        : task.title;
      await api.updateTask(task.id, {
        title: finalTitle,`;
if (!src.includes(oldSave)) { console.error('FAIL Step 5: handleSave pattern not found'); process.exit(1); }
src = src.replace(oldSave, newSave);
console.log('Step 5 ok (handleSave fallback)');

// ── Step 6: add openMerge + handleMerge before handleSave ─────────────────
const insertBefore = '  const handleSave = async () => {';
const helperFunctions = `  const openMerge = async () => {
    setMergeOpen(true);
    if (mergeCandidates.length > 0) return;
    setMergeLoadingState(true);
    try {
      const data = await api.getTasks({ date: task.date });
      setMergeCandidates(
        (Array.isArray(data) ? data : data?.tasks || []).filter((t) => t.id !== task.id),
      );
    } catch {
      setMergeCandidates([]);
    } finally {
      setMergeLoadingState(false);
    }
  };

  const handleMerge = async (targetId) => {
    setMerging(true);
    try {
      await api.mergeTasks(task.id, targetId);
      toast.success('Tâches fusionnées');
      onSave?.();
      onClose();
    } catch {
      toast.error('Erreur lors de la fusion');
    } finally {
      setMerging(false);
    }
  };

  `;
if (!src.includes(insertBefore)) { console.error('FAIL Step 6: handleSave anchor not found'); process.exit(1); }
src = src.replace(insertBefore, helperFunctions + insertBefore);
console.log('Step 6 ok (openMerge + handleMerge)');

// ── Step 7: add merge UI before </div> </ModalLayout> ─────────────────────
const closeForm = `      </div>
    </ModalLayout>`;

const mergeUI = `        {/* ── Fusion de tâches ── */}
        <div className="tem-field full">
          <div className="tem-merge-header">
            <Button
              variant="ghost"
              type="button"
              className="tem-merge-toggle"
              onClick={mergeOpen ? () => setMergeOpen(false) : openMerge}
            >
              <GitMerge size={13} />
              {mergeOpen ? 'Annuler la fusion' : 'Fusionner avec une autre tâche\u2026'}
            </Button>
          </div>
          {mergeOpen && (
            <div className="tem-merge-panel">
              <Input
                type="text"
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                placeholder="Filtrer par titre ou affaire\u2026"
                className="tem-merge-search"
              />
              {mergeLoadingState ? (
                <div className="tem-merge-loading">
                  <Loader size={14} className="spin" /> Chargement\u2026
                </div>
              ) : (
                <div className="tem-merge-list">
                  {mergeCandidates
                    .filter((c) => {
                      if (!mergeSearch.trim()) return true;
                      const q = mergeSearch.toLowerCase();
                      return (
                        (c.title || '').toLowerCase().includes(q) ||
                        (c.affaireNum || c.affaire_num || '').toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 20)
                    .map((c) => (
                      <div key={c.id} className="tem-merge-item">
                        <span className="tem-merge-item-title">
                          {(c.affaireNum || c.affaire_num)
                            ? <strong>{c.affaireNum || c.affaire_num} \u2014 </strong>
                            : null}
                          {initTitle(c)}
                        </span>
                        <span className="tem-merge-item-meta">
                          {c.personFirstName || ''} {c.personLastName || ''} \u00b7 {c.section || ''}
                        </span>
                        <Button
                          variant="ghost"
                          type="button"
                          className="tem-merge-btn"
                          onClick={() => handleMerge(c.id)}
                          disabled={merging}
                        >
                          {merging
                            ? <Loader size={12} className="spin" />
                            : <GitMerge size={12} />}
                          Fusionner
                        </Button>
                      </div>
                    ))}
                  {mergeCandidates.length === 0 && !mergeLoadingState && (
                    <div className="tem-merge-empty">Aucune autre t\u00e2che pour cette date</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
` + closeForm;

if (!src.includes(closeForm)) { console.error('FAIL Step 7: closeForm anchor not found'); process.exit(1); }
// Replace only last occurrence (in case there are multiple)
const lastIdx = src.lastIndexOf(closeForm);
src = src.slice(0, lastIdx) + mergeUI + src.slice(lastIdx + closeForm.length);
console.log('Step 7 ok (merge UI)');

writeFileSync(path, src, 'utf8');
console.log('Done! Lines:', src.split('\n').length);
