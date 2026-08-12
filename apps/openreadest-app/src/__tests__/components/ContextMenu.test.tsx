import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ContextMenu from '@/components/ContextMenu';
import Menu from '@/components/Menu';
import MenuItem from '@/components/MenuItem';
import { EnvProvider } from '@/context/EnvContext';

vi.mock('@/services/environment', async () => {
  const actual = await vi.importActual('@/services/environment');
  return {
    ...actual,
    default: {
      getAppService: vi.fn().mockResolvedValue({}),
    },
  };
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom 中 offsetWidth/offsetHeight 为 0，夹紧需按 0 尺寸验证（恒在视口内）
const renderMenu = (props: Partial<React.ComponentProps<typeof ContextMenu>> = {}) => {
  const onClose = vi.fn();
  render(
    <EnvProvider>
      <ContextMenu x={100} y={100} onClose={onClose} {...props}>
        <Menu className='menu-content'>
          <MenuItem label='Test Item' onClick={vi.fn()} />
        </Menu>
      </ContextMenu>
    </EnvProvider>,
  );
  return { onClose };
};

describe('ContextMenu Component', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders children at the given coordinates', () => {
    renderMenu({ x: 250, y: 300 });
    const menu = document.querySelector('.context-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.style.left).toBe('250px');
    expect(menu.style.top).toBe('300px');
    expect(screen.getByText('Test Item')).toBeTruthy();
  });

  it('clamps position to the viewport when near the bottom-right edge', () => {
    renderMenu({ x: 5000, y: 5000 });
    const menu = document.querySelector('.context-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    // offsetWidth 在 jsdom 为 0，maxX = innerWidth - margin，因此恒被夹紧
    expect(Number(menu.style.left.replace('px', ''))).toBeLessThanOrEqual(window.innerWidth);
    expect(Number(menu.style.top.replace('px', ''))).toBeGreaterThanOrEqual(0);
    expect(Number(menu.style.top.replace('px', ''))).toBeLessThanOrEqual(window.innerHeight);
  });

  it('renders the overlay for outside-click dismissal', () => {
    renderMenu();
    const overlay = document.querySelector('.overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
  });

  it('closes on outside overlay click', () => {
    const { onClose } = renderMenu();
    const overlay = document.querySelector('.overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
