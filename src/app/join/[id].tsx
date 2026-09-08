/**
 * The counter code, when the OS opens the app with it. The web page next to
 * this file (`[id].web.tsx`) is what a browser shows; here the link does
 * what the scanner does — connects the customer to the shop.
 */
import { NativeLinkLanding } from '@/components/native-link-landing';

export default function JoinLink() {
  return <NativeLinkLanding type="shop" />;
}
