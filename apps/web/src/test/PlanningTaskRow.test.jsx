import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Mock design-system
vi.mock('@/design-system', () => ({
  Button: ({ children, onClick, className, title, ...rest }) => (
    <button onClick={onClick} className={className} title={title} {...rest}>
      {children}
    </button>
  ),
  Input: ({ onChange, ...props }) => <input onChange={onChange} {...props} />,
  Tooltip: ({ children }) => <>{children}</>,
}));

// Mock AffaireBadge
vi.mock('../components/AffaireBadge', () => ({
  default: ({ numero }) => <span data-testid="affaire-badge">{numero}</span>,
}));

// Mock lucide icons
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="icon-check" />,
  Clock: () => <span data-testid="icon-clock" />,
  Edit2: () => <span data-testid="icon-edit" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eyeoff" />,
  Link: () => <span data-testid="icon-link" />,
  X: () => <span data-testid="icon-x" />,
  Truck: () => <span data-testid="icon-truck" />,
  MapPin: () => <span data-testid="icon-mappin" />,
}));

import { PlanningTaskRow } from '../components/planning/PlanningTaskRow';

const baseProps = {
  affaireByNum: new Map(),
  onNavigateToEntity: vi.fn(),
  onCycleStatus: vi.fn(),
  onDelete: vi.fn(),
  onToggleVisible: vi.fn(),
  onEdit: vi.fn(),
  onLinkTask: vi.fn(),
  linkingTaskId: null,
  setLinkingTaskId: vi.fn(),
  linkTaskSearchQuery: '',
  setLinkTaskSearchQuery: vi.fn(),
  affaires: [],
  selectedDate: '2025-06-01',
  renderMultiAssign: vi.fn(() => null),
};

const makeTask = (overrides = {}) => ({
  id: 1,
  title: 'Tester la salle',
  status: 'pending',
  section: 'manual',
  visible: 1,
  sourceType: 'manual',
  googleEventTitle: '',
  affaireNum: '',
  notes: '',
  time: '',
  endTime: '',
  period: '',
  eventType: '',
  locationAddress: '',
  reservation_vehicle_name: '',
  reservation_vehicle_reg: '',
  personFirstName: '',
  personLastName: '',
  ...overrides,
});

describe('PlanningTaskRow', () => {
  it('affiche le titre de la tache', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ title: 'Ranger le depot' })} />);
    expect(screen.getByText(/Ranger le depot/)).toBeInTheDocument();
  });

  it('affiche le badge Affaire quand affaireNum present', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ affaireNum: 'AF12345' })} />);
    expect(screen.getByTestId('affaire-badge')).toHaveTextContent('AF12345');
  });

  it('affiche l icone Check quand status done', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ status: 'done' })} />);
    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
  });

  it('affiche l icone Clock quand status in_progress', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ status: 'in_progress' })} />);
    expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
  });

  it('appelle onCycleStatus au clic sur le bouton status', async () => {
    const user = userEvent.setup();
    const task = makeTask();
    render(<PlanningTaskRow {...baseProps} task={task} />);
    const statusBtn = screen.getByTitle(/Statut:.*cliquer pour changer/);
    await user.click(statusBtn);
    expect(baseProps.onCycleStatus).toHaveBeenCalledWith(task);
  });

  it('appelle onEdit au clic sur le bouton modifier', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const task = makeTask();
    render(<PlanningTaskRow {...baseProps} onEdit={onEdit} task={task} />);
    // Le bouton modifier a la classe "edit"
    const editBtns = document.querySelectorAll('button.edit');
    expect(editBtns.length).toBeGreaterThan(0);
    await user.click(editBtns[0]);
    expect(onEdit).toHaveBeenCalledWith(task);
  });

  it('appelle onDelete au clic sur le bouton supprimer', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const task = makeTask({ id: 42 });
    render(<PlanningTaskRow {...baseProps} onDelete={onDelete} task={task} />);
    const deleteBtns = document.querySelectorAll('button.delete');
    expect(deleteBtns.length).toBeGreaterThan(0);
    await user.click(deleteBtns[0]);
    expect(onDelete).toHaveBeenCalledWith(42);
  });

  it('appelle onToggleVisible au clic', async () => {
    const user = userEvent.setup();
    const onToggleVisible = vi.fn();
    const task = makeTask();
    render(<PlanningTaskRow {...baseProps} onToggleVisible={onToggleVisible} task={task} />);
    const visibleBtns = document.querySelectorAll('button.toggle-visible');
    expect(visibleBtns.length).toBeGreaterThan(0);
    await user.click(visibleBtns[0]);
    expect(onToggleVisible).toHaveBeenCalledWith(task);
  });

  it('ajoute la classe task-done-row quand status done', () => {
    const { container } = render(
      <PlanningTaskRow {...baseProps} task={makeTask({ status: 'done' })} />,
    );
    expect(container.querySelector('.task-done-row')).toBeInTheDocument();
  });

  it('ajoute la classe google-task-row quand sourceType google_event', () => {
    const { container } = render(
      <PlanningTaskRow {...baseProps} task={makeTask({ sourceType: 'google_event' })} />,
    );
    expect(container.querySelector('.google-task-row')).toBeInTheDocument();
  });

  it('affiche le badge Google G quand google_event', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ sourceType: 'google_event' })} />);
    expect(screen.getByText('G')).toBeInTheDocument();
  });

  it('ajoute la classe hidden-display quand visible=0', () => {
    const { container } = render(
      <PlanningTaskRow {...baseProps} task={makeTask({ visible: 0 })} />,
    );
    expect(container.querySelector('.hidden-display')).toBeInTheDocument();
  });

  it('affiche le vehicule quand reservation_vehicle_name', () => {
    render(
      <PlanningTaskRow {...baseProps} task={makeTask({ reservation_vehicle_name: 'Camion 1' })} />,
    );
    expect(screen.getByText(/Camion 1/)).toBeInTheDocument();
  });

  it('affiche le lien adresse quand locationAddress', () => {
    render(
      <PlanningTaskRow {...baseProps} task={makeTask({ locationAddress: '12 rue de la Paix' })} />,
    );
    const link = screen.getByText(/12 rue de la Paix/);
    expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
  });

  it('affiche les notes inline', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ notes: 'Urgent' })} />);
    expect(screen.getByText('(Urgent)')).toBeInTheDocument();
  });

  it('affiche le temps avec horaire', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ time: '09:00', endTime: '11:00' })} />);
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.getByText(/11:00/)).toBeInTheDocument();
  });

  it('affiche le bouton Lier quand pas d affaireNum', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ affaireNum: '' })} />);
    expect(screen.getByTestId('icon-link')).toBeInTheDocument();
  });

  it('n affiche pas le bouton Lier quand affaireNum present', () => {
    render(<PlanningTaskRow {...baseProps} task={makeTask({ affaireNum: 'AF12345' })} />);
    expect(screen.queryByTestId('icon-link')).not.toBeInTheDocument();
  });
});
