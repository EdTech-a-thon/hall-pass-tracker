/**
 * Closing a tab the kiosk depends on stops passes from getting through, so the
 * browser asks "Leave site?" first. Browsers show their own wording; a page
 * can only ask for the question, not change it. A reload the app makes on
 * purpose, like after restoring a backup, skips it.
 */
let leavingOnPurpose = false;

export function askBeforeLeaving(event: BeforeUnloadEvent, when: boolean) {
  if (when && !leavingOnPurpose) event.preventDefault();
}

export function leaveTo(href: string) {
  leavingOnPurpose = true;
  location.href = href;
}
