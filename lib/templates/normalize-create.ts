/**
 * Normalise un payload de création de modèle Meta pour l'API Zernio.
 *
 * Zernio (POST /v1/whatsapp/templates) valide `components` avec une union
 * discriminée Zod dont les types sont en MINUSCULES — « header » | « body » |
 * « footer » | « buttons » | « limited_time_offer » | « carousel » — alors que
 * notre formulaire (et l'API Meta) produisent des majuscules (« HEADER »…).
 *
 * La normalisation se limite aux champs `type` (type de chaque composant,
 * format d'en-tête, type de chaque bouton) : le reste du payload (name,
 * category, language, parameter_format, textes, exemples, URLs) part tel quel.
 * Un payload inattendu (non objet, sans `components`) est renvoyé inchangé :
 * la validation appartient à l'API amont.
 */
export function normalizeTemplateCreatePayload(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return body;
  const source = body as Record<string, unknown>;
  if (!Array.isArray(source.components)) return body;
  return { ...source, components: source.components.map(normalizeComponent) };
}

function normalizeComponent(component: unknown): unknown {
  if (typeof component !== 'object' || component === null) return component;
  const source = component as Record<string, unknown>;
  const next: Record<string, unknown> = { ...source, type: lower(source.type) };
  if ('format' in next) next.format = lower(next.format);
  if (Array.isArray(next.buttons)) next.buttons = next.buttons.map(normalizeButton);
  return next;
}

function normalizeButton(button: unknown): unknown {
  if (typeof button !== 'object' || button === null) return button;
  const source = button as Record<string, unknown>;
  return { ...source, type: lower(source.type) };
}

function lower(value: unknown): unknown {
  return typeof value === 'string' ? value.toLowerCase() : value;
}
