/**
 * The receipt code, when the OS opens the app with it. The web page next to
 * this file (`[id].web.tsx`) is what a browser shows; here the link does
 * what the scanner does — claims the load onto the account.
 */
import { NativeLinkLanding } from '@/components/native-link-landing';

export default function ClaimLink() {
  return <NativeLinkLanding type="order" />;
}
