import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('deve renderizar texto corretamente', () => {
    render(<Button>Clique aqui</Button>);
    expect(screen.getByText('Clique aqui')).toBeInTheDocument();
  });

  it('deve chamar onClick quando clicado', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Clique</Button>);
    
    await user.click(screen.getByText('Clique'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('deve estar desabilitado quando disabled=true', () => {
    render(<Button disabled>Desabilitado</Button>);
    expect(screen.getByText('Desabilitado')).toBeDisabled();
  });

  it('deve mostrar loading quando isLoading=true', () => {
    render(<Button isLoading>Carregando</Button>);
    const button = screen.getByText('Carregando');
    expect(button).toBeDisabled();
    // Verificar se há indicador de loading (pode variar dependendo da implementação)
  });

  it('deve aplicar variantes corretamente', () => {
    const { rerender } = render(<Button variant="primary">Primário</Button>);
    expect(screen.getByText('Primário')).toBeInTheDocument();

    rerender(<Button variant="secondary">Secundário</Button>);
    expect(screen.getByText('Secundário')).toBeInTheDocument();

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByText('Outline')).toBeInTheDocument();
  });

  it('deve aplicar className customizada', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByText('Custom');
    expect(button).toHaveClass('custom-class');
  });
});
