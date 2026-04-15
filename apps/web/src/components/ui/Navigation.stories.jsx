import { Tabs, TabList, Tab, TabPanel } from '../components/ui/Tabs';
import Accordion from '../components/ui/Accordion';

export default { title: 'Molécules/Navigation' };

/* ── Tabs ── */
export const TabsDefault = () => (
  <Tabs defaultValue="tab1">
    <TabList>
      <Tab value="tab1">Général</Tab>
      <Tab value="tab2">Détails</Tab>
      <Tab value="tab3" disabled>Archivé</Tab>
    </TabList>
    <TabPanel value="tab1">Contenu de l'onglet Général</TabPanel>
    <TabPanel value="tab2">Contenu de l'onglet Détails</TabPanel>
    <TabPanel value="tab3">Contenu archivé</TabPanel>
  </Tabs>
);

/* ── Accordion ── */
export const AccordionDefault = () => (
  <div style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 4 }}>
    <Accordion title="Section 1" defaultOpen>
      <p>Contenu de la section 1 (ouverte par défaut).</p>
    </Accordion>
    <Accordion title="Section 2">
      <p>Contenu de la section 2.</p>
    </Accordion>
    <Accordion title="Section 3">
      <p>Contenu de la section 3.</p>
    </Accordion>
  </div>
);
