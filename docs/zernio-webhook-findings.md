# Vérification Zernio — 1 septembre 2026

La documentation publique Zernio confirme que les Inbox webhooks supportent l’événement `message.received`, décrit comme déclenché lorsqu’un nouveau message arrive dans l’inbox. Le schéma inclut un identifiant stable d’événement (`id`), `event`, un objet `message`, le contexte `conversation`, le contexte `account`, un champ `metadata` optionnel et un horodatage UTC `timestamp`.

La documentation recommande de vérifier la signature de la requête, d’utiliser `timestamp` pour détecter les événements en double ou retardés, de limiter l’abonnement aux seuls événements nécessaires et d’exposer le webhook en HTTPS. Le projet implémente donc un token de routage par utilisateur, une validation de l’événement, une déduplication optionnelle par identifiant et une réponse idempotente.

Sources consultées :

- https://docs.zernio.com/webhooks — index des webhooks Zernio.
- https://docs.zernio.com/webhooks/inbox — événements et schéma Inbox webhook.
