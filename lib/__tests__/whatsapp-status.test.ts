import { describe, expect, it } from 'vitest';
import { whatsappStatusFromAccounts } from '@/lib/flows/whatsapp-status';

// État réel du canal WhatsApp : le mapper doit refléter ce que Zernio renvoie
// (y compris les comptes déconnectés par le système), sans jamais inventer.

describe('whatsappStatusFromAccounts', () => {
  it('retourne found=false quand aucune réponse exploitable', () => {
    expect(whatsappStatusFromAccounts(null).found).toBe(false);
    expect(whatsappStatusFromAccounts({}).found).toBe(false);
    expect(whatsappStatusFromAccounts({ accounts: [] }).found).toBe(false);
  });

  it('retourne found=false quand il n’y a que des comptes non-WhatsApp', () => {
    const out = whatsappStatusFromAccounts({
      accounts: [{ _id: 'a', platform: 'facebook', isActive: true }],
    });
    expect(out.found).toBe(false);
  });

  it('détecte un compte WhatsApp connecté avec son numéro', () => {
    const out = whatsappStatusFromAccounts({
      accounts: [
        {
          _id: 'wa1',
          platform: 'whatsapp',
          displayName: 'kamtech',
          isActive: true,
          enabled: true,
          metadata: { displayPhoneNumber: '+237 6 81 83 40 88' },
        },
      ],
    });
    expect(out.found).toBe(true);
    expect(out.connected).toBe(true);
    expect(out.displayName).toBe('kamtech');
    expect(out.phone).toBe('+237 6 81 83 40 88');
    expect(out.humanReason).toBeNull();
  });

  it('expose la déconnexion système avec date et raison traduite', () => {
    const out = whatsappStatusFromAccounts({
      accounts: [
        {
          _id: 'wa1',
          platform: 'whatsapp',
          displayName: 'kamtech',
          isActive: false,
          metadata: {
            displayPhoneNumber: '+237 6 81 83 40 88',
            coexistenceDisconnectedAt: '2026-09-07T16:27:42.365Z',
            coexistenceDisconnectEvent: 'PARTNER_REMOVED',
            coexistenceDisconnectInfo: { reason: 'ACCOUNT_DISCONNECTED', initiated_by: 'SYSTEM' },
          },
        },
      ],
    });
    expect(out.found).toBe(true);
    expect(out.connected).toBe(false);
    expect(out.disconnectedAt).toBe('2026-09-07T16:27:42.365Z');
    expect(out.disconnectEvent).toBe('PARTNER_REMOVED');
    expect(out.disconnectReason).toBe('ACCOUNT_DISCONNECTED');
    expect(out.humanReason).toContain('partenaire technique');
    expect(out.humanReason).not.toMatch(/undefined|null/i);
  });

  it('garde le code brut si l’événement est inconnu (jamais inventé)', () => {
    const out = whatsappStatusFromAccounts({
      accounts: [
        {
          platform: 'whatsapp',
          isActive: false,
          metadata: { coexistenceDisconnectEvent: 'SOMETHING_ELSE' },
        },
      ],
    });
    expect(out.connected).toBe(false);
    expect(out.humanReason).toContain('SOMETHING_ELSE');
  });

  it('préfère un compte actif quand plusieurs comptes WhatsApp existent', () => {
    const out = whatsappStatusFromAccounts({
      accounts: [
        { _id: 'dead', platform: 'whatsapp', isActive: false },
        { _id: 'live', platform: 'whatsapp', isActive: true },
      ],
    });
    expect(out.connected).toBe(true);
  });

  it('considère un compte déconnecté même sans metadata de déconnexion', () => {
    const out = whatsappStatusFromAccounts({
      accounts: [{ _id: 'wa1', platform: 'whatsapp', isActive: false }],
    });
    expect(out.found).toBe(true);
    expect(out.connected).toBe(false);
    expect(out.humanReason).toContain('reconnecter');
  });
});
