/**
 * Design System — Barrel export
 *
 * Usage :
 *   import { Card, Panel, Button, Input, Tag, Badge, Tabs, Tab } from '../components/ui';
 */

/* ─── Existants ─── */
export { default as Card } from './Card';
export { default as DetailRow } from './DetailRow';
export { default as FormField } from './FormField';
export { default as Panel } from './Panel';
export { default as ScrollArea } from './ScrollArea';
export { default as SectionHeader } from './SectionHeader';
export { default as Table } from './Table';

/* ─── [DS] Atomes Étape 3 ─── */
import './Button.css';
import './Input.css';
import './Textarea.css';
import './Select.css';
import './Checkbox.css';
import './Tag.css';
import './Avatar.css';
import './Tooltip.css';
import './ProgressBar.css';
import './Loader.css';

export { default as Avatar } from './Avatar';
export { default as Button } from './Button';
export { Checkbox, Toggle } from './Checkbox';
export { default as Input } from './Input';
export { default as ProgressBar } from './ProgressBar';
export { default as Select } from './Select';
export { default as StatusBadge } from './StatusBadge';
export { Badge, Tag } from './Tag';
export { default as Textarea } from './Textarea';
export { default as Tooltip } from './Tooltip';
import './EmptyState.css';
export { default as EmptyState } from './EmptyState';
import './TabBadge.css';
export { default as TabBadge } from './TabBadge';
import './InlineAlert.css';
export { default as InlineAlert } from './InlineAlert';
export { LoadingOverlay, Spinner } from './Loader';
import './Skeleton.css';
export { default as Skeleton } from './Skeleton';

/* ─── [DS] Molécules Étape 4 ─── */
import './DropdownMenu.css';
import './Tabs.css';
import './Accordion.css';
import './SearchBar.css';
import './FilterBar.css';
import './ListItem.css';

export { default as Accordion } from './Accordion';
export { default as Divider } from './Divider';
export { DropdownDivider, DropdownItem, DropdownMenu } from './DropdownMenu';
export { default as EntityCombobox } from './EntityCombobox';
export { default as FilterBar } from './FilterBar';
export { default as ListItem } from './ListItem';
export { default as SearchBar } from './SearchBar';
export { Tab, TabList, TabPanel, Tabs } from './Tabs';

/* ─── [DS] Organismes Étape 5 ─── */
import './Modal.css';
import './Dialog.css';
import './Drawer.css';
import './BottomSheet.css';
import './PageHeader.css';
import './FormLayout.css';
import './ModuleLayout.css';

export { default as ModalLayout } from '../../layouts/ModalLayout';
export { default as BottomSheet } from './BottomSheet';
export { default as Dialog } from './Dialog';
export { default as Drawer } from './Drawer';
export { FormActions, FormLayout, FormRow, FormSection } from './FormLayout';
export { Modal, ModalBody, ModalFooter, ModalHeader } from './Modal';
export {
  ModuleContent,
  ModuleFooter,
  ModuleLayout,
  ModuleToolbar,
  SplitLayout,
} from './ModuleLayout';
export { default as PageHeader } from './PageHeader';
