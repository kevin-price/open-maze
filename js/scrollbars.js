/**
 * scrollbars.js
 * Combined arrow-button + draggable-thumb scroll controls for the canvas.
 * The canvas uses touch-action:none for game controls, so native touch-scroll
 * is disabled. These controls let mobile users scroll the maze view.
 */

const SCROLL_STEP  = 80;   // px per button tick
const SCROLL_DELAY = 120;  // ms before auto-repeat starts
const SCROLL_RATE  = 80;   // ms between auto-repeat ticks

export function initScrollbars() {
  const scroll     = document.getElementById('canvas-scroll');
  const colGrp     = document.getElementById('scroll-col');
  const rowGrp     = document.getElementById('scroll-row');
  const btnUp      = document.getElementById('scroll-up');
  const btnDown    = document.getElementById('scroll-down');
  const btnLeft    = document.getElementById('scroll-left');
  const btnRight   = document.getElementById('scroll-right');
  const trackV     = document.getElementById('scroll-track-v');
  const thumbV     = document.getElementById('scroll-thumb-v');
  const trackH     = document.getElementById('scroll-track-h');
  const thumbH     = document.getElementById('scroll-thumb-h');

  if (!scroll || !colGrp || !rowGrp) return;

  // ── Visibility ─────────────────────────────────────────────────────────────

  function updateVisibility() {
    const needsV = scroll.scrollHeight > scroll.clientHeight + 1;
    const needsH = scroll.scrollWidth  > scroll.clientWidth  + 1;
    colGrp.dataset.hidden = needsV ? 'false' : 'true';
    rowGrp.dataset.hidden = needsH ? 'false' : 'true';
    if (needsV) updateThumb('v');
    if (needsH) updateThumb('h');
  }

  // ── Thumb position sync ────────────────────────────────────────────────────

  function updateThumb(axis) {
    if (axis === 'v') {
      const trackPx  = trackV.clientHeight;
      const thumbPx  = Math.max(32, (scroll.clientHeight / scroll.scrollHeight) * trackPx);
      const maxScroll = scroll.scrollHeight - scroll.clientHeight;
      const thumbTop  = maxScroll > 0
        ? (scroll.scrollTop / maxScroll) * (trackPx - thumbPx)
        : 0;
      thumbV.style.height = thumbPx + 'px';
      thumbV.style.top    = thumbTop + 'px';
    } else {
      const trackPx  = trackH.clientWidth;
      const thumbPx  = Math.max(32, (scroll.clientWidth / scroll.scrollWidth) * trackPx);
      const maxScroll = scroll.scrollWidth - scroll.clientWidth;
      const thumbLeft = maxScroll > 0
        ? (scroll.scrollLeft / maxScroll) * (trackPx - thumbPx)
        : 0;
      thumbH.style.width = thumbPx + 'px';
      thumbH.style.left  = thumbLeft + 'px';
    }
  }

  // ── Arrow button tap-and-hold ──────────────────────────────────────────────

  function makeScrollButton(btn, axis, direction) {
    let repeatTimer = null;

    function scrollOnce() {
      if (axis === 'v') scroll.scrollTop  += direction * SCROLL_STEP;
      else              scroll.scrollLeft += direction * SCROLL_STEP;
    }

    function start(e) {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId); // keeps repeat going even if finger drifts off button
      scrollOnce();
      repeatTimer = setTimeout(function repeat() {
        scrollOnce();
        repeatTimer = setTimeout(repeat, SCROLL_RATE);
      }, SCROLL_DELAY);
    }

    function stop() {
      clearTimeout(repeatTimer);
      repeatTimer = null;
    }

    btn.addEventListener('pointerdown',   start);
    btn.addEventListener('pointerup',     stop);
    btn.addEventListener('pointercancel', stop);
    // no pointerleave — pointer capture handles cleanup via pointerup
  }

  // ── Thumb drag ─────────────────────────────────────────────────────────────

  function makeThumbDraggable(thumb, track, axis) {
    thumb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startPointer = axis === 'v' ? e.clientY : e.clientX;
      const startScroll  = axis === 'v' ? scroll.scrollTop : scroll.scrollLeft;
      // Snapshot sizes at drag start so they stay stable throughout
      const trackPx  = axis === 'v' ? track.clientHeight : track.clientWidth;
      const thumbPx  = axis === 'v' ? thumb.offsetHeight : thumb.offsetWidth;
      const maxScroll = axis === 'v'
        ? scroll.scrollHeight - scroll.clientHeight
        : scroll.scrollWidth  - scroll.clientWidth;

      function onMove(e) {
        e.preventDefault();
        const delta = (axis === 'v' ? e.clientY : e.clientX) - startPointer;
        const ratio = delta / (trackPx - thumbPx);
        if (axis === 'v') scroll.scrollTop  = startScroll + ratio * maxScroll;
        else              scroll.scrollLeft = startScroll + ratio * maxScroll;
      }

      function onEnd() {
        document.removeEventListener('pointermove',   onMove);
        document.removeEventListener('pointerup',     onEnd);
        document.removeEventListener('pointercancel', onEnd);
      }

      // Document-level listeners survive the pointer leaving the thumb element
      document.addEventListener('pointermove',   onMove,  { passive: false });
      document.addEventListener('pointerup',     onEnd);
      document.addEventListener('pointercancel', onEnd);
    });
  }

  // ── Track click-to-jump ────────────────────────────────────────────────────

  function makeTrackClickable(track, thumb, axis) {
    track.addEventListener('pointerdown', (e) => {
      if (e.target === thumb) return;
      const rect  = track.getBoundingClientRect();
      const pos   = axis === 'v' ? e.clientY - rect.top : e.clientX - rect.left;
      const size  = axis === 'v' ? track.clientHeight    : track.clientWidth;
      const ratio = pos / size;
      if (axis === 'v') scroll.scrollTop  = ratio * (scroll.scrollHeight - scroll.clientHeight);
      else              scroll.scrollLeft = ratio * (scroll.scrollWidth  - scroll.clientWidth);
    });
  }

  // ── Wire everything ────────────────────────────────────────────────────────

  makeScrollButton(btnUp,    'v', -1);
  makeScrollButton(btnDown,  'v', +1);
  makeScrollButton(btnLeft,  'h', -1);
  makeScrollButton(btnRight, 'h', +1);

  makeThumbDraggable(thumbV, trackV, 'v');
  makeThumbDraggable(thumbH, trackH, 'h');

  makeTrackClickable(trackV, thumbV, 'v');
  makeTrackClickable(trackH, thumbH, 'h');

  // ── Mouse wheel scroll ─────────────────────────────────────────────────────

  scroll.addEventListener('wheel', (e) => {
    e.preventDefault();
    scroll.scrollTop  += e.deltaY;
    scroll.scrollLeft += e.deltaX;
  }, { passive: false });

  scroll.addEventListener('scroll', updateVisibility);

  const ro = new ResizeObserver(updateVisibility);
  ro.observe(scroll);
  ro.observe(document.getElementById('canvas'));

  updateVisibility();
}
