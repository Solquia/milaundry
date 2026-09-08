import { claimHeadline, claimInvitation, claimSubmitLabel } from '../web-claim';

describe('claim page copy', () => {
  it('names the shop in the headline', () => {
    expect(claimHeadline('Sparkle Wash')).toBe('Your laundry at Sparkle Wash');
  });

  it('still reads well when the shop is unknown, as it is for a claimed receipt', () => {
    expect(claimHeadline(null)).toBe('Your laundry receipt');
    expect(claimInvitation(null)).not.toContain('from ');
  });

  it('tells a guest what a name and number get them', () => {
    expect(claimInvitation('Sparkle Wash')).toMatch(/name and mobile number/i);
    expect(claimInvitation('Sparkle Wash')).toContain('Sparkle Wash');
  });

  it('labels the button for a guest and for someone already signed in', () => {
    expect(claimSubmitLabel(false)).toBe('Follow this order');
    expect(claimSubmitLabel(true)).toBe('Open this order');
  });
});
