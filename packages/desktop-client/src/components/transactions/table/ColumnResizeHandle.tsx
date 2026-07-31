import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

const HANDLE_WIDTH = 7;
const KEYBOARD_STEP = 8;

type ColumnResizeHandleProps = {
  label: string;
  onResizeStart: () => void;
  /** Total horizontal distance dragged since the pointer went down. */
  onResize: (delta: number) => void;
  onResizeEnd: () => void;
  onReset: () => void;
};

/**
 * The draggable divider sitting on the boundary between two header cells. It
 * only reports pointer deltas — the header owns the width arithmetic, since it
 * is the piece that knows which columns the boundary separates.
 */
export function ColumnResizeHandle({
  label,
  onResizeStart,
  onResize,
  onResizeEnd,
  onReset,
}: ColumnResizeHandleProps) {
  const startXRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef(0);

  const flushPendingFrame = () => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Left button only, and never let the press reach the sort button
    // underneath.
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    onResizeStart();
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
      return;
    }
    // Pointer events can outpace paint; coalesce them so a fast drag doesn't
    // re-render every visible row more than once per frame.
    pendingRef.current = e.clientX - startXRef.current;
    if (frameRef.current == null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        onResize(pendingRef.current);
      });
    }
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
      return;
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
    flushPendingFrame();
    onResize(e.clientX - startXRef.current);
    onResizeEnd();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? -KEYBOARD_STEP : KEYBOARD_STEP;
    onResizeStart();
    onResize(delta);
    onResizeEnd();
  };

  return (
    <View
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className={css({
        // The divider only reveals itself on approach, so the header stays
        // clean until the pointer is actually near a boundary.
        '& > *': { backgroundColor: 'transparent' },
        '&:hover > *, &:focus-visible > *': {
          backgroundColor: theme.tableBorderSeparator,
        },
      })}
      style={{
        position: 'absolute',
        // Straddles the border so the cursor changes just before the pointer
        // crosses into the neighbouring column, from either side.
        right: -Math.floor(HANDLE_WIDTH / 2),
        top: 0,
        bottom: 0,
        width: HANDLE_WIDTH,
        cursor: 'col-resize',
        alignItems: 'center',
        zIndex: 1,
        touchAction: 'none',
      }}
    >
      <View
        style={{
          width: 1,
          height: '100%',
          transition: 'background-color 100ms',
        }}
      />
    </View>
  );
}
