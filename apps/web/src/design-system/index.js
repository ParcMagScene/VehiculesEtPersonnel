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
  /* Layout / Structure */
  Card,
  Panel,
  SectionHeader,
  Table,
  ScrollArea,
  FormField,
  DetailRow,

  /* Atomes */
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Toggle,
  Tag,
  Badge,
  StatusBadge,
  Avatar,
  Tooltip,
  Spinner,
  LoadingOverlay,
  ProgressBar,
  Skeleton,
  EmptyState,
  InlineAlert,

  /* Molécules */
  DropdownMenu,
  DropdownItem,
  DropdownDivider,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Accordion,
  Divider,
  SearchBar,
  FilterBar,
  ListItem,
  EntityCombobox,

  /* Organismes */
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalLayout,
  Dialog,
  Drawer,
  BottomSheet,
  PageHeader,
  FormLayout,
  FormSection,
  FormRow,
  FormActions,
  ModuleLayout,
  ModuleToolbar,
  ModuleContent,
  ModuleFooter,
  SplitLayout,
} from '../components/ui';
