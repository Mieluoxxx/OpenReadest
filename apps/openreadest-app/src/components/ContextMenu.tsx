import clsx from 'clsx';
import React, { useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { Overlay } from '@/components/Overlay';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';

interface ContextMenuProps {
  x: number; // 触发点 clientX（键盘路径由调用方传条目中心）
  y: number; // 触发点 clientY
  onClose: () => void;
  children: React.ReactNode; // 期望 <Menu> / <MenuItem> 结构
  className?: string;
}

const VIEWPORT_MARGIN = 8;

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useKeyDownActions({ onCancel: onClose });

  // 测量自身真实尺寸并做视口夹紧；依赖 [x, y] 重算，窗口 resize 后重新夹紧
  useLayoutEffect(() => {
    const clamp = () => {
      const el = containerRef.current;
      if (!el) return;
      const { offsetWidth, offsetHeight } = el;
      const maxX = window.innerWidth - offsetWidth - VIEWPORT_MARGIN;
      const maxY = window.innerHeight - offsetHeight - VIEWPORT_MARGIN;
      setPosition({
        x: Math.max(VIEWPORT_MARGIN, Math.min(x, maxX)),
        y: Math.max(VIEWPORT_MARGIN, Math.min(y, maxY)),
      });
    };
    clamp();
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [x, y]);

  return ReactDOM.createPortal(
    <>
      <Overlay onDismiss={onClose} />
      <div
        ref={containerRef}
        role='none'
        className={clsx('context-menu fixed z-[110]', className)}
        style={{ left: position.x, top: position.y }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
};

export default ContextMenu;
