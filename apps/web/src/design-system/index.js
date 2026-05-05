/**
 * Design System — Point d'entrée canonique
 * ══════════════════════════════════════════════════
 *
 * Utilisation dans les modules :
 *   import { Button, Input, Select, Modal, Panel, Card, Table, Tabs } from '@/design-system';
 *
 * Ce fichier est une façade : les composants résident dans
 * components/ui/ (source de vérité).
 *
 * Composants disponibles :
 *
 *   ATOMES         Button, Input, Textarea, Select, Checkbox, Toggle,
 *                  Tag, Badge, Avatar, Tooltip, Spinner, LoadingOverlay,
 *                  ProgressBar, EmptyState, InlineAlert
 *
 *   MOLÉCULES      DropdownMenu, DropdownItem, DropdownDivider,
 *                  Tabs, TabList, Tab, TabPanel,
 *                  Accordion, Divider, SearchBar, FilterBar, ListItem,
 *                  EntityCombobox
 *
 *   ORGANISMES     Modal, ModalHeader, ModalBody, ModalFooter,
 *                  Dialog, Drawer, BottomSheet, PageHeader,
 *                  FormLayout, FormSection, FormRow, FormActions,
 *                  ModuleLayout, ModuleToolbar, ModuleContent,
 *                  ModuleFooter, SplitLayout
 *
 *   LAYOUT         Card, Panel, SectionHeader, Table,
 *                  ScrollArea, FormField, DetailRow
 *
 * Règles :
 *   ✅ Toujours importer depuis ce fichier (ou components/ui)
 *   ❌ Ne jamais créer de composant local qui duplique ces exports
 *   ❌ Ne jamais utiliser de styles inline pour ce qui est tokenisé
 *   ❌ Ne jamais utiliser de valeurs brutes (hex, px) hors tokens
 */

/* ── Tokens sémantiques ── */
import '../design/tokens.css';

/* ── Ré-export complet de components/ui ── */
export {
  Accordion,
  Avatar,
  Badge,
  BottomSheet,
  /* Atomes */
  Button,
  /* Layout / Structure */
  Card,
  Checkbox,
  DetailRow,
  Dialog,
  Divider,
  Drawer,
  DropdownDivider,
  DropdownItem,
  /* Molécules */
  DropdownMenu,
  EmptyState,
  EntityCombobox,
  FilterBar,
  FormActions,
  FormField,
  FormLayout,
  FormRow,
  FormSection,
  InlineAlert,
  Input,
  ListItem,
  LoadingOverlay,
  /* Organismes */
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalLayout,
  ModuleContent,
  ModuleFooter,
  ModuleLayout,
  ModuleToolbar,
  PageHeader,
  Panel,
  ProgressBar,
  ScrollArea,
  SearchBar,
  SectionHeader,
  Select,
  Skeleton,
  Spinner,
  SplitLayout,
  StatusBadge,
  Tab,
  Table,
  TabList,
  TabPanel,
  Tabs,
  Tag,
  Textarea,
  Toggle,
  Tooltip,
} from '../components/ui';
