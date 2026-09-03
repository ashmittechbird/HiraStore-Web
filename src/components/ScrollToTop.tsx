import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Start each new page at the top.
 *
 * A single-page app keeps the window's scroll position across navigations, so
 * following a footer link from the bottom of a long shop page dropped you at
 * the bottom of the next one — usually somewhere in its footer, looking like
 * nothing had happened. React Router only resets scroll for you through
 * <ScrollRestoration>, which needs a data router; this app uses BrowserRouter.
 *
 * Three behaviours, in order:
 *
 *  - Back and forward are left alone. The reader is returning to something they
 *    have already seen, and yanking them to the top loses their place.
 *  - A link carrying a #hash scrolls to that element.
 *  - Everything else goes to the top.
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();

  // useLayoutEffect, not useEffect: this runs before the browser paints, so the
  // new page never flashes at the old scroll offset on its way to the top.
  useLayoutEffect(() => {
    if (navigationType === 'POP') return;

    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
      // No such anchor — fall through to the top rather than leaving the reader
      // stranded at the previous page's scroll position.
    }

    // globals.css sets `scroll-behavior: smooth` for in-page jumps, which would
    // otherwise animate the whole height of the page on every navigation.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search, hash, navigationType]);

  return null;
}
