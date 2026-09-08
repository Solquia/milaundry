/**
 * The words on the page a receipt's code opens in a browser.
 *
 * The docket stapled to the bag carries https://<host>/claim/<order>?token=.
 * In the app the scanner claims the load directly; a phone camera lands here,
 * where the shop's name is shown first (the token vouches for it), and a name
 * and number are enough to put the load on an account and follow it.
 */

export function claimHeadline(shopName: string): string {
  return `Your laundry at ${shopName}`;
}

export function claimInvitation(shopName: string): string {
  return `Enter your name and mobile number to follow this load from ${shopName} and see when it is ready. No app needed.`;
}

/** Someone already signed in only needs to open it; a guest is following it for the first time. */
export function claimSubmitLabel(hasSession: boolean): string {
  return hasSession ? 'Open this order' : 'Follow this order';
}
