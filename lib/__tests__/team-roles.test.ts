import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  TEAM_ROLES,
  hasPermission,
  isValidRole,
  permissionsForRole,
  roleLabel,
  sanitizePermissions,
} from '@/lib/team/roles';
import {
  DEFAULT_EXPIRY_DAYS,
  INVITE_EXPIRY_OPTIONS,
  formatExpiry,
  inviteExpiryDate,
  isValidExpiryDays,
} from '@/lib/team/invite-share';
import { generateInviteToken, hashInviteToken } from '@/lib/team/tokens';

describe('rôles d’équipe', () => {
  it('couvre exactement les 4 rôles prédéfinis', () => {
    expect(TEAM_ROLES).toEqual(['admin', 'manager', 'agent', 'viewer']);
  });

  it('un rôle valide est reconnu, une valeur inconnue rejetée', () => {
    expect(isValidRole('agent')).toBe(true);
    expect(isValidRole('proprietaire')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole(null)).toBe(false);
    expect(isValidRole(42)).toBe(false);
  });

  it('l’administrateur a toutes les autorisations', () => {
    expect(permissionsForRole('admin')).toEqual(ALL_PERMISSIONS);
  });

  it('chaque rôle a un jeu d’autorisations cohérent (subset strict)', () => {
    for (const role of TEAM_ROLES) {
      const perms = permissionsForRole(role);
      expect(new Set(perms).size).toBe(perms.length);
      for (const perm of perms) {
        expect(ALL_PERMISSIONS).toContain(perm);
      }
    }
  });

  it('l’agent peut envoyer des messages mais pas gérer campagnes/équipe/paramètres', () => {
    const perms = permissionsForRole('agent');
    expect(hasPermission(perms, PERMISSIONS.messagesSend)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.campaignsManage)).toBe(false);
    expect(hasPermission(perms, PERMISSIONS.teamManage)).toBe(false);
    expect(hasPermission(perms, PERMISSIONS.settingsManage)).toBe(false);
  });

  it('l’observateur est en lecture seule', () => {
    const perms = permissionsForRole('viewer');
    expect(hasPermission(perms, PERMISSIONS.messagesView)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.messagesSend)).toBe(false);
    expect(hasPermission(perms, PERMISSIONS.contactsManage)).toBe(false);
  });

  it('le gestionnaire gère campagnes et contacts, pas l’équipe', () => {
    const perms = permissionsForRole('manager');
    expect(hasPermission(perms, PERMISSIONS.campaignsManage)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.contactsManage)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.teamManage)).toBe(false);
  });

  it('les libellés sont en français et non vides', () => {
    expect(roleLabel('owner')).toBe('Propriétaire');
    for (const role of TEAM_ROLES) {
      expect(ROLE_DEFINITIONS[role].label.length).toBeGreaterThan(2);
      expect(ROLE_DEFINITIONS[role].description.length).toBeGreaterThan(10);
    }
  });

  it('sanitizePermissions filtre les valeurs inconnues et les doublons', () => {
    const result = sanitizePermissions([
      PERMISSIONS.messagesView,
      'pirate.mode',
      PERMISSIONS.flowsManage,
      PERMISSIONS.messagesView,
      123,
    ]);
    expect(result).toEqual([PERMISSIONS.messagesView, PERMISSIONS.flowsManage]);
    expect(sanitizePermissions('not-an-array')).toEqual([]);
  });
});

describe('jetons de lien magique', () => {
  it('génère des jetons URL-safe uniques de 256 bits', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateInviteToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('l’empreinte est déterministe, hexadécimale (SHA-256), et ne contient jamais le jeton', () => {
    const token = generateInviteToken();
    const hash = hashInviteToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashInviteToken(token));
    expect(hash).not.toContain(token);
    expect(hashInviteToken('autre-jeton')).not.toBe(hash);
  });
});

describe('expiration des invitations', () => {
  it('les options d’expiration sont validées strictement', () => {
    expect(isValidExpiryDays(7)).toBe(true);
    expect(isValidExpiryDays(1)).toBe(true);
    expect(isValidExpiryDays(30)).toBe(true);
    expect(isValidExpiryDays(2)).toBe(false);
    expect(isValidExpiryDays('7')).toBe(false);
    expect(isValidExpiryDays(7.5)).toBe(false);
  });

  it('l’expiration par défaut est de 7 jours et inviteExpiryDate projette dans le futur', () => {
    expect(DEFAULT_EXPIRY_DAYS).toBe(7);
    expect(INVITE_EXPIRY_OPTIONS).toHaveLength(4);
    const before = Date.now();
    const expires = inviteExpiryDate(1).getTime();
    expect(expires - before).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 5);
  });

  it('formatExpiry décrit le temps restant ou écoulé en français', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    const in6days = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const ago1h = new Date(now.getTime() - 60 * 60 * 1000);
    expect(formatExpiry(in6days, now)).toBe('Expire dans 6 jours');
    expect(formatExpiry(in2h, now)).toBe('Expire dans 2 heures');
    expect(formatExpiry(ago1h, now)).toBe('Expiré depuis 1 heure');
  });
});
