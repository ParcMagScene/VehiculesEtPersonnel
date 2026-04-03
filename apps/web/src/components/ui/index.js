/**
 * Design System — Barrel export
 * 
 * Usage :
 *   import { Card, Panel, Button, Input, Tag, Badge, Tabs, Tab } from '../components/ui';
 */

/* ─── Existants ─── */
export { default as Card } from './Card';
export { default as Panel } from './Panel';
export { default as SectionHeader } from './SectionHeader';
export { default as Table } from './Table';
export { default as ScrollArea } from './ScrollArea';
export { default as FormField } from './FormField';
export { default as DetailRow } from './DetailRow';

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

export { default as Button } from './Button';
export { default as Input } from './Input';
export { default as Textarea } from './Textarea';
export { default as Select } from './Select';
export { Checkbox, Toggle } from './Checkbox';
export { Tag, Badge } from './Tag';
export { default as StatusBadge } from './StatusBadge';
export { default as Avatar } from './Avatar';
export { default as Tooltip } from './Tooltip';
export { default as ProgressBar } from './ProgressBar';
import './EmptyState.css';
export { default as EmptyState } from './EmptyState';
import './InlineAlert.css';
export { default as InlineAlert } from './InlineAlert';
export { Spinner, LoadingOverlay } from './Loader';

/* ─── [DS] Molécules Étape 4 ─── */
import './DropdownMenu.css';
import './Tabs.css';
import './Accordion.css';
import './SearchBar.css';
import './FilterBar.css';
import './ListItem.css';

export { DropdownMenu, DropdownItem, DropdownDivider } from './DropdownMenu';
export { Tabs, TabList, Tab, TabPanel } from './Tabs';
export { default as Accordion } from './Accordion';
export { default as Divider } from './Divider';
export { default as SearchBar } from './SearchBar';
export { default as FilterBar } from './FilterBar';
export { default as ListItem } from './ListItem';
export { default as EntityCombobox } from './EntityCombobox';

/* ─── [DS] Organismes Étape 5 ─── */
import './Modal.css';
import './Dialog.css';
import './Drawer.css';
import './PageHeader.css';
import './FormLayout.css';
import './ModuleLayout.css';

export { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
export { default as ModalLayout } from '../../layouts/ModalLayout';
export { default as Dialog } from './Dialog';
export { default as Drawer } from './Drawer';
export { default as PageHeader } from './PageHeader';
export { FormLayout, FormSection, FormRow, FormActions } from './FormLayout';
export { ModuleLayout, ModuleToolbar, ModuleContent, ModuleFooter, SplitLayout } from './ModuleLayout';
