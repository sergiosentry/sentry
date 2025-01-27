import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Overlay} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

const TOOLTIP_OFFSET = 10;

interface Options {
  /**
   * Function used to compute the text of the cursor tooltip. Recieves the %
   * value the cursor is within the container.
   */
  labelText: (percentPosition: number) => string;
  /**
   * May be set to false to disable rendering the timeline cursor
   */
  enabled?: boolean;
}

function useTimelineCursor<E extends HTMLElement>({enabled = true, labelText}: Options) {
  const rafIdRef = useRef<number | null>(null);

  const containerRef = useRef<E>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const [isVisible, setIsVisible] = useState(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }

      if (containerRef.current === null) {
        return;
      }

      const containerRect = containerRef.current.getBoundingClientRect();

      // Instead of using onMouseEnter / onMouseLeave we check if the mouse is
      // within the containerRect. This proves to be less glitchy as some
      // elements within the container may trigger an onMouseLeave even when
      // the mouse is still "inside" of the container
      const isInsideContainer =
        e.clientX > containerRect.left &&
        e.clientX < containerRect.right &&
        e.clientY > containerRect.top &&
        e.clientY < containerRect.bottom;

      if (isInsideContainer !== isVisible) {
        setIsVisible(isInsideContainer);
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (containerRef.current === null || labelRef.current === null) {
          return;
        }

        const offset = e.clientX - containerRect.left;
        const tooltipWidth = labelRef.current.offsetWidth;

        labelRef.current.innerText = labelText(offset / containerRect.width);

        containerRef.current.style.setProperty('--cursorOffset', `${offset}px`);
        containerRef.current.style.setProperty('--cursorMax', `${containerRect.width}px`);
        containerRef.current.style.setProperty('--cursorLabelWidth', `${tooltipWidth}px`);
      });
    },
    [isVisible, labelText]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('mousemove', handleMouseMove);
    } else {
      setIsVisible(false);
    }

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [enabled, handleMouseMove]);

  const timelineCursor = (
    <AnimatePresence>
      {isVisible && (
        <Fragment>
          <Cursor role="presentation" />
          <CursorLabel ref={labelRef} animated placement="right" />
        </Fragment>
      )}
    </AnimatePresence>
  );

  return {cursorContainerRef: containerRef, timelineCursor};
}

const Cursor = styled(motion.div)`
  pointer-events: none;
  background: ${p => p.theme.translucentBorder};
  width: 2px;
  height: 100%;
  position: absolute;
  top: 0;
  left: clamp(0px, var(--cursorOffset), var(--cursorMax));
  transform: translateX(-2px);
  z-index: 3;
`;

Cursor.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  transition: testableTransition({duration: 0.1}),
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1},
    exit: {opacity: 0},
  },
};

const CursorLabel = styled(Overlay)`
  font-variant-numeric: tabular-nums;
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  position: absolute;
  top: 12px;
  left: clamp(
    0px,
    calc(var(--cursorOffset) + ${TOOLTIP_OFFSET}px),
    calc(var(--cursorMax) - var(--cursorLabelWidth) - ${TOOLTIP_OFFSET}px)
  );
`;

export {useTimelineCursor};
