import { describe, expect, it } from 'vitest';

import { whatsappSendErrorFr } from '../whatsapp/send-errors';

/**
 * Les messages sources sont ceux réellement renvoyés par l'API Zernio/Meta
 * (capturés par les sondes production scripts/probe-new-contact-templates.mjs).
 */
describe('whatsappSendErrorFr', () => {
  it('traduit TEMPLATE_REQUIRED (contact froid sans modèle)', () => {
    const out = whatsappSendErrorFr(
      "WhatsApp conversations must start with an approved template, or with a Direct Send utility message (category: 'utility' plus a message) on eligible accounts",
    );
    expect(out).toContain('modèle approuvé');
    expect(out).toContain('Choisissez');
  });

  it('traduit INVALID_TEMPLATE_PARAMS (nombre de valeurs incorrect)', () => {
    const out = whatsappSendErrorFr(
      'templateParams supplies 1 value(s) but this template takes 4 in header -> body -> URL-button order (0 header, 4 body, 0 URL button). Append the missing value(s), or send button values via templateButtonParams. (template parrainage_amie)',
    );
    expect(out).toContain('nombre de champs');
  });

  it('traduit un template introuvable (404)', () => {
    const out = whatsappSendErrorFr(
      'Template not found. Make sure the template name and language code match exactly (e.g., "en_US" not "en").',
    );
    expect(out).toContain("n'existe pas côté WhatsApp");
  });

  it('traduit le hors-fenêtre 24 h Meta (131047)', () => {
    const out = whatsappSendErrorFr(
      'Message failed to send because more than 24 hours have passed since the customer last replied to this number (131047)',
    );
    expect(out).toContain('24 h');
    expect(out).toContain('modèle approuvé');
  });

  it('traduit un numéro absent de WhatsApp (131030)', () => {
    const out = whatsappSendErrorFr(
      'Recipient phone number not in WhatsApp (131030)',
    );
    expect(out).toContain('indicateur du pays');
  });

  it('traduit un décalage de variables Meta (132000)', () => {
    const out = whatsappSendErrorFr(
      'Template parameter count mismatch (#132000)',
    );
    expect(out).toContain('variables différentes');
  });

  it('renvoie tel quel un message inconnu (pas d invention)', () => {
    expect(whatsappSendErrorFr('Some unexpected upstream failure')).toBe(
      'Some unexpected upstream failure',
    );
  });

  it('couvre un message vide', () => {
    expect(whatsappSendErrorFr('')).toContain("L'envoi a échoué");
  });
});
