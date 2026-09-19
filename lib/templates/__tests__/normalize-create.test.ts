import { describe, expect, it } from 'vitest';
import { normalizeTemplateCreatePayload } from '../normalize-create';

describe('normalizeTemplateCreatePayload', () => {
  it('renvoie tel quel un corps sans tableau components', () => {
    const body = { name: 'ok', category: 'MARKETING' };
    expect(normalizeTemplateCreatePayload(body)).toBe(body);
    expect(normalizeTemplateCreatePayload('x')).toBe('x');
    expect(normalizeTemplateCreatePayload(null)).toBe(null);
  });

  it('passe en minuscules types de composants, format et boutons', () => {
    const body = {
      name: 'rdv',
      category: 'MARKETING',
      language: 'fr',
      parameter_format: 'POSITIONAL',
      components: [
        { type: 'HEADER', format: 'TEXT', text: 'Bonjour' },
        { type: 'BODY', text: 'Message {{1}}', example: { body_text: [['x']] } },
        { type: 'FOOTER', text: 'Répondez STOP' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Oui' },
            { type: 'URL', text: 'Voir', url: 'https://x.y' },
            { type: 'PHONE_NUMBER', text: 'Appeler', phone_number: '+237600000000' },
          ],
        },
      ],
    };
    const out = normalizeTemplateCreatePayload(body) as {
      parameter_format?: unknown;
      components: Array<{
        type?: unknown;
        format?: unknown;
        text?: unknown;
        example?: unknown;
        buttons?: Array<Record<string, unknown>>;
      }>;
    };
    expect(out.parameter_format).toBe('POSITIONAL');
    expect(out.components[0]).toEqual({ type: 'header', format: 'text', text: 'Bonjour' });
    expect(out.components[1]?.type).toBe('body');
    expect(out.components[1]?.example).toEqual({ body_text: [['x']] });
    expect(out.components[2]?.type).toBe('footer');
    expect(out.components[3]?.type).toBe('buttons');
    expect(out.components[3]?.buttons?.[0]).toEqual({ type: 'quick_reply', text: 'Oui' });
    expect(out.components[3]?.buttons?.[1]).toEqual({ type: 'url', text: 'Voir', url: 'https://x.y' });
    expect(out.components[3]?.buttons?.[2]).toEqual({
      type: 'phone_number',
      text: 'Appeler',
      phone_number: '+237600000000',
    });
  });

  it('tolère des composants ou boutons malformés sans planter', () => {
    const body = { components: ['x', null, { type: 'BODY' }, { type: 'BUTTONS', buttons: ['y', null] }] };
    const out = normalizeTemplateCreatePayload(body) as {
      components: Array<{ type?: unknown; buttons?: unknown }>;
    };
    expect(out.components[0]).toBe('x');
    expect(out.components[1]).toBe(null);
    expect(out.components[2]).toEqual({ type: 'body' });
    expect(out.components[3].type).toBe('buttons');
    expect(out.components[3].buttons).toEqual(['y', null]);
  });

  it('gère un format absent ou non chaîne', () => {
    const body = { components: [{ type: 'BODY', format: undefined }, { type: 42 }] };
    const out = normalizeTemplateCreatePayload(body) as { components: Array<Record<string, unknown>> };
    expect(out.components[0].type).toBe('body');
    expect('format' in out.components[0]).toBe(true);
    expect(out.components[1].type).toBe(42);
  });
});
