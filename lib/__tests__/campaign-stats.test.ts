import { describe, expect, it } from 'vitest';
import { cumulativeStats, directSendStats, dominantFailure } from '../campaigns/stats';

describe('cumulativeStats (destinataires natifs Zernio)', () => {
  it('compte un destinataire lu dans envoyés, livrés ET lus', () => {
    const stats = cumulativeStats([
      {
        status: 'read',
        sentAt: '2026-09-02T15:40:38.671Z',
        deliveredAt: '2026-09-02T15:40:47.000Z',
        readAt: '2026-09-02T15:40:48.000Z',
      },
    ]);
    expect(stats).toEqual({ total: 1, sent: 1, delivered: 1, read: 1, failed: 0, pending: 0 });
  });

  it('compte un destinataire livré (non lu) dans envoyés et livrés', () => {
    const stats = cumulativeStats([{ status: 'delivered', sentAt: '2026-09-02T15:00:00Z' }]);
    expect(stats).toEqual({ total: 1, sent: 1, delivered: 1, read: 0, failed: 0, pending: 0 });
  });

  it('compte les échecs séparément, jamais dans les envoyés', () => {
    const stats = cumulativeStats([
      { status: 'failed' },
      { status: 'failed' },
      { status: 'sent', sentAt: '2026-09-02T15:00:00Z' },
    ]);
    expect(stats).toEqual({ total: 3, sent: 1, delivered: 0, read: 0, failed: 2, pending: 0 });
  });

  it('laisse les pending hors des envoyés', () => {
    const stats = cumulativeStats([{ status: 'pending' }, { status: null }]);
    expect(stats).toEqual({ total: 2, sent: 0, delivered: 0, read: 0, failed: 0, pending: 2 });
  });

  it('reproduit le cas réel : compteurs Zernio faux, totaux corrects', () => {
    // Production : "Testé 2" — objet broadcast sentCount=0/delivered=0/read=1
    // alors que le destinataire est read avec tous les horodatages.
    const rows = [
      { status: 'read', sentAt: '2026-09-02T15:40:38.671Z', deliveredAt: '2026-09-02T15:40:47.000Z', readAt: '2026-09-02T15:40:48.000Z' },
      { status: 'failed' },
    ];
    const stats = cumulativeStats(rows);
    expect(stats.sent).toBe(1);
    expect(stats.delivered).toBe(1);
    expect(stats.read).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.total).toBe(2);
  });
});

describe('directSendStats (envois directs campaign_sends)', () => {
  it('additionne les statuts réels des envois directs', () => {
    const stats = directSendStats([{ status: 'READ' }, { status: 'DELIVERED' }, { status: 'SENT' }, { status: 'FAILED' }]);
    expect(stats).toEqual({ total: 4, sent: 3, delivered: 2, read: 1, failed: 1, pending: 0 });
  });

  it('compte une ligne sans statut comme envoyé (la ligne n existe que si l envoi a réussi)', () => {
    const stats = directSendStats([{ status: null }]);
    expect(stats.total).toBe(1);
    expect(stats.pending).toBe(0);
    expect(stats.sent).toBe(1);
  });
});

describe('dominantFailure (raisons d échec officielles Zernio)', () => {
  it('retourne la raison dominante avec son code', () => {
    const reason = dominantFailure([
      { status: 'failed', error: 'Template parameter count mismatch. The number of variables provided does not match the template definition.', errorCode: 132000 },
      { status: 'failed', error: 'Template parameter count mismatch. The number of variables provided does not match the template definition.', errorCode: 132000 },
      { status: 'read' },
    ]);
    expect(reason).toContain('Template parameter count mismatch');
    expect(reason).toContain('132000');
    expect(reason).toContain('2 destinataires');
  });

  it('retourne null quand aucun échec documenté', () => {
    expect(dominantFailure([{ status: 'failed' }, { status: 'read' }])).toBeNull();
  });
});
