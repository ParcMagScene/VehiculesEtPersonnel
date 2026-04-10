import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabList, Tab, TabPanel } from '../components/ui/Tabs';

function renderTabs(props = {}) {
  return render(
    <Tabs defaultValue="a" {...props}>
      <TabList>
        <Tab value="a">Onglet A</Tab>
        <Tab value="b">Onglet B</Tab>
        <Tab value="c" disabled>Onglet C</Tab>
      </TabList>
      <TabPanel value="a">Contenu A</TabPanel>
      <TabPanel value="b">Contenu B</TabPanel>
      <TabPanel value="c">Contenu C</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('renders tab buttons', () => {
    renderTabs();
    expect(screen.getByText('Onglet A')).toBeInTheDocument();
    expect(screen.getByText('Onglet B')).toBeInTheDocument();
  });

  it('shows default panel content', () => {
    renderTabs();
    expect(screen.getByText('Contenu A')).toBeInTheDocument();
    expect(screen.queryByText('Contenu B')).toBeNull();
  });

  it('switches panel on tab click', async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByText('Onglet B'));
    expect(screen.getByText('Contenu B')).toBeInTheDocument();
    expect(screen.queryByText('Contenu A')).toBeNull();
  });

  it('calls onChange on tab click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTabs({ onChange });
    await user.click(screen.getByText('Onglet B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('marks active tab with aria-selected', () => {
    renderTabs();
    const tabA = screen.getByRole('tab', { name: 'Onglet A' });
    const tabB = screen.getByRole('tab', { name: 'Onglet B' });
    expect(tabA).toHaveAttribute('aria-selected', 'true');
    expect(tabB).toHaveAttribute('aria-selected', 'false');
  });

  it('disabled tab cannot be clicked', async () => {
    const user = userEvent.setup();
    renderTabs();
    const tabC = screen.getByRole('tab', { name: 'Onglet C' });
    expect(tabC).toBeDisabled();
    await user.click(tabC);
    expect(screen.queryByText('Contenu C')).toBeNull();
  });

  it('supports controlled mode', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Tabs value="a" onChange={onChange}>
        <TabList>
          <Tab value="a">A</Tab>
          <Tab value="b">B</Tab>
        </TabList>
        <TabPanel value="a">Panel A</TabPanel>
        <TabPanel value="b">Panel B</TabPanel>
      </Tabs>
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    await user.click(screen.getByText('B'));
    expect(onChange).toHaveBeenCalledWith('b');
    // Still shows A because controlled
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    // Rerender with new value
    rerender(
      <Tabs value="b" onChange={onChange}>
        <TabList>
          <Tab value="a">A</Tab>
          <Tab value="b">B</Tab>
        </TabList>
        <TabPanel value="a">Panel A</TabPanel>
        <TabPanel value="b">Panel B</TabPanel>
      </Tabs>
    );
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });

  it('TabList has role="tablist"', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('TabPanel has role="tabpanel"', () => {
    renderTabs();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });
});
