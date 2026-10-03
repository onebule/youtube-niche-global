'use client';

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { ASSISTANT_SIZE, assistantDragMoved, assistantPanelPosition, clampAssistantPosition, type AssistantBounds, type AssistantPoint } from '@/src/lib/canvas-assistant-position';
import styles from './canvas-text-chat.module.css';

type Props = {
  open: boolean; zh: boolean; launcherRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void; onPanelStyle: (style: CSSProperties) => void;
};

function viewportBounds(): AssistantBounds {
  const viewport = window.visualViewport;
  const left = (viewport?.offsetLeft || 0) + 12;
  const top = Math.max(viewport?.offsetTop || 0, document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) + 12;
  return { left, top, width: Math.max(0, (viewport?.width || innerWidth) - 24), height: Math.max(0, (viewport?.height || innerHeight) + (viewport?.offsetTop || 0) - top - 12) };
}

export default function CanvasAssistantLauncher({ open, zh, launcherRef, onToggle, onPanelStyle }: Props) {
  const [position, setPosition] = useState<AssistantPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const positionRef = useRef<AssistantPoint | null>(null);
  const drag = useRef<{ id: number; start: AssistantPoint; origin: AssistantPoint; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const panelStyleRef = useRef(onPanelStyle);
  useEffect(() => { panelStyleRef.current = onPanelStyle; }, [onPanelStyle]);

  const place = (point: AssistantPoint) => {
    const bounds = viewportBounds();
    const next = clampAssistantPosition(point, bounds);
    positionRef.current = next; setPosition(next);
    panelStyleRef.current(assistantPanelPosition(next, bounds));
  };
  useEffect(() => {
    const resize = () => {
      const bounds = viewportBounds();
      const next = clampAssistantPosition(positionRef.current || { x: bounds.left + bounds.width - ASSISTANT_SIZE.width - 10, y: bounds.top + bounds.height - ASSISTANT_SIZE.height - 12 }, bounds);
      positionRef.current = next; setPosition(next);
      panelStyleRef.current(assistantPanelPosition(next, bounds));
    };
    const frame = requestAnimationFrame(resize);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize); };
  }, []);

  return <button ref={launcherRef} className={styles.launcher} type="button"
    style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
    data-dragging={dragging} aria-expanded={open} aria-controls="canvas-claude-chat"
    aria-label={zh ? 'Claude 文本助手，点击聊天；方向键移动，Home 归位' : 'Claude text assistant. Click to chat; arrow keys to move, Home to reset'}
    title={zh ? '拖动挪位置 · 点击聊天' : 'Drag to move · Click to chat'}
    onPointerDown={event => {
      event.stopPropagation();
      if (!event.isPrimary || event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      suppressClick.current = false;
      drag.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: rect.left, y: rect.top }, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      event.stopPropagation(); const active = drag.current;
      if (!active || active.id !== event.pointerId) return;
      const current = { x: event.clientX, y: event.clientY };
      active.moved ||= assistantDragMoved(active.start, current);
      if (active.moved) { setDragging(true); place({ x: active.origin.x + current.x - active.start.x, y: active.origin.y + current.y - active.start.y }); }
    }}
    onPointerUp={event => {
      event.stopPropagation();
      if (drag.current?.id !== event.pointerId) return;
      suppressClick.current = drag.current.moved; drag.current = null; setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={event => { event.stopPropagation(); if (drag.current?.id === event.pointerId) { suppressClick.current = true; drag.current = null; setDragging(false); } }}
    onLostPointerCapture={() => { if (drag.current) { suppressClick.current = drag.current.moved; drag.current = null; setDragging(false); } }}
    onWheel={event => event.stopPropagation()}
    onKeyDown={event => {
      const delta: Record<string, AssistantPoint> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } };
      if (event.key !== 'Home' && !delta[event.key]) return;
      event.preventDefault(); event.stopPropagation(); const bounds = viewportBounds();
      const origin = positionRef.current || { x: bounds.left, y: bounds.top };
      place(event.key === 'Home' ? { x: bounds.left + bounds.width - ASSISTANT_SIZE.width - 10, y: bounds.top + bounds.height - ASSISTANT_SIZE.height - 12 } : { x: origin.x + delta[event.key].x, y: origin.y + delta[event.key].y });
    }}
    onClick={event => { event.stopPropagation(); if (suppressClick.current && event.detail !== 0) { suppressClick.current = false; return; } suppressClick.current = false; onToggle(); }}>
    <svg className={styles.cat} viewBox="0 0 100 88" aria-hidden="true">
      <ellipse className={styles.catShadow} cx="50" cy="81" rx="27" ry="4" />
      <g className={styles.catBody}>
        <path d="M73 67C95 53 96 76 79 77" fill="none" stroke="#c1b1a7" strokeWidth="10" strokeLinecap="round" />
        <path d="M28 61C24 80 34 81 50 81S77 80 72 61" fill="#f8efe2" stroke="#c8b8a9" strokeWidth="1.2" />
        <path d="M31 31L26 6Q27 1 32 5L46 18M68 31L75 6Q74 1 69 5L54 18" fill="#b3a29a" stroke="#887973" strokeWidth="1.2" />
        <path d="M30 9L33 24L41 18M71 9L67 24L59 18" fill="#dfb9b2" />
        <path d="M25 39Q22 14 50 15Q80 14 76 40Q84 54 71 65Q50 76 29 65Q17 54 25 39" fill="#faf2e7" stroke="#c8b8a9" strokeWidth="1.2" />
        <path d="M26 35Q26 18 45 18L42 43L30 53Q22 47 26 35M74 35Q74 18 55 18L58 43L70 53Q78 47 74 35" fill="#aa9a91" />
        <path d="M50 22L39 51Q50 57 61 51Z" fill="#fff9f0" />
        <g className={styles.catEyes}>
          <ellipse cx="36" cy="42" rx="6.5" ry="7" fill="#76b7d2" /><ellipse cx="64" cy="42" rx="6.5" ry="7" fill="#76b7d2" />
          <ellipse cx="37" cy="42" rx="2.7" ry="5" fill="#253b51" /><ellipse cx="63" cy="42" rx="2.7" ry="5" fill="#253b51" />
          <circle cx="34" cy="39" r="1.8" fill="white" /><circle cx="61" cy="39" r="1.8" fill="white" />
        </g>
        <path d="M46 53Q50 50 54 53L50 57Z" fill="#bd8f8d" />
        <path d="M50 57V59M50 59Q45 64 42 59M50 59Q55 64 58 59" fill="none" stroke="#887973" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M32 55L18 52M32 59L17 60M68 55L82 52M68 59L83 60" stroke="#b4a299" strokeWidth="1" strokeLinecap="round" />
        <path d="M35 74V79M42 74V79M58 74V79M65 74V79" stroke="#c8b8a9" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M34 67Q50 73 66 67" fill="none" stroke="#0b756f" strokeWidth="3" />
        <circle cx="50" cy="72" r="3" fill="#0b756f" />
      </g>
    </svg>
    <span className={styles.catLabel}>Claude <span>{zh ? '文本助手' : 'assistant'}</span></span>
    <span className={styles.catHint}>{zh ? '拖动 · 点击聊天' : 'Drag · Click to chat'}</span>
  </button>;
}
