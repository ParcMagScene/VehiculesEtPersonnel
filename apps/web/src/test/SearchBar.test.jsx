import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from '../components/ui/SearchBar';

describe('SearchBar', () => {
  it('affiche le placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Rechercher…" />);
    expect(screen.getByPlaceholderText('Rechercher…')).toBeInTheDocument();
  });

  it('appelle onChange immédiatement sans debounce', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('retarde onChange avec debounce', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} debounce={300} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledWith('abc');
    vi.useRealTimers();
  });

  it('affiche le bouton clear quand il y a une valeur', () => {
    render(<SearchBar value="test" onChange={() => {}} />);
    expect(screen.getByLabelText('Effacer la recherche')).toBeInTheDocument();
  });

  it('efface la valeur au clic sur clear', () => {
    const onChange = vi.fn();
    render(<SearchBar value="test" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Effacer la recherche'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('accepte size sm et md', () => {
    const { container, rerender } = render(<SearchBar value="" onChange={() => {}} size="sm" />);
    expect(container.querySelector('.ui-search-bar--sm')).toBeInTheDocument();
    rerender(<SearchBar value="" onChange={() => {}} size="md" />);
    expect(container.querySelector('.ui-search-bar--md')).toBeInTheDocument();
  });
});
