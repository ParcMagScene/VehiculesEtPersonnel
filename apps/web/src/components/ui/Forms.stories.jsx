import { Checkbox, Toggle } from '../components/ui/Checkbox';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

export default { title: 'Atomes/Formulaires' };

/* ── Input ── */
export const InputDefault = () => <Input placeholder="Saisir du texte…" />;
export const InputSizes = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300 }}>
    {['sm', 'md', 'lg'].map((s) => (
      <Input key={s} size={s} placeholder={`Taille ${s}`} />
    ))}
  </div>
);
export const InputError = () => <Input error placeholder="Champ en erreur" />;
export const InputWithPrefix = () => <Input prefix="€" placeholder="Montant" />;

/* ── Textarea ── */
export const TextareaDefault = () => <Textarea placeholder="Description…" rows={3} />;

/* ── Select ── */
export const SelectDefault = () => (
  <Select
    placeholder="Choisir…"
    options={[
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
      { value: 'c', label: 'Option C', disabled: true },
    ]}
  />
);

/* ── Checkbox ── */
export const CheckboxDefault = () => <Checkbox label="Accepter les conditions" />;
export const CheckboxIndeterminate = () => <Checkbox label="Sélection partielle" indeterminate />;
export const CheckboxDisabled = () => <Checkbox label="Désactivé" disabled checked />;

/* ── Toggle ── */
export const ToggleDefault = () => <Toggle label="Mode sombre" />;
export const ToggleSizes = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {['sm', 'md', 'lg'].map((s) => (
      <Toggle key={s} size={s} label={`Taille ${s}`} />
    ))}
  </div>
);
