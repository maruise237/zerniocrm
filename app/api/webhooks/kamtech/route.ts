/**
 * Webhook entrant — URL à marque Kamtech affichée dans les Paramètres.
 *
 * Alias du handler historique `/api/webhooks/zernio` : la logique de
 * réception (authentification par token, déduplication, insertion du
 * message) vit dans ce dernier et reste active — les webhooks déjà
 * enregistrés avec l'ancienne URL continuent donc de fonctionner sans
 * aucune action. Les deux URLs partagent le même token et le même
 * traitement, seule la chemin affiché à l'utilisateur change.
 */
export { POST } from '@/app/api/webhooks/zernio/route';
