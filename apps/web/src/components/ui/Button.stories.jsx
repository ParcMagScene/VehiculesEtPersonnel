import Button from '../components/ui/Button';

export default {
  title: 'Atomes/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'success', 'warning', 'ghost'],
    },
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
  },
};

export const Primary = { args: { children: 'Valider', variant: 'primary' } };
export const Secondary = { args: { children: 'Annuler', variant: 'secondary' } };
export const Danger = { args: { children: 'Supprimer', variant: 'danger' } };
export const Success = { args: { children: 'Confirmer', variant: 'success' } };
export const Ghost = { args: { children: 'Lien', variant: 'ghost' } };
export const Loading = { args: { children: 'Chargement…', loading: true } };
export const Disabled = { args: { children: 'Désactivé', disabled: true } };

export const AllSizes = () => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    {['xs', 'sm', 'md', 'lg'].map((s) => (
      <Button key={s} size={s}>
        {s.toUpperCase()}
      </Button>
    ))}
  </div>
);

export const AllVariants = () => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {['primary', 'secondary', 'danger', 'success', 'warning', 'ghost'].map((v) => (
      <Button key={v} variant={v}>
        {v}
      </Button>
    ))}
  </div>
);
