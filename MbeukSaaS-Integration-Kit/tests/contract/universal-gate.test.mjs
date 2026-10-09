import test from "node:test";
import assert from "node:assert/strict";
import {
  GateStatus,
  NETWORK_ERROR_MESSAGE,
  NO_LICENSE_MESSAGE,
  accessGrantedFromPaymentReturn,
  authFeedback,
  credentialsFromForm,
  hideObsoleteRenewActions,
  isNetworkError,
  normalizeEntitlement,
} from "../../templates/frontend/universal-barrier/mbeuk-hub-gate.js";

test("normalise un essai valide avec jours restants", () => {
  const result = normalizeEntitlement(
    {
      valid: true,
      subscription: {
        status: "trial",
        trial_ends_at: "2026-09-14T00:00:00.000Z",
      },
    },
    new Date("2026-09-11T00:00:00.000Z"),
  );
  assert.equal(result.status, GateStatus.TRIAL);
  assert.equal(result.label, "Essai gratuit");
  assert.equal(result.daysRemaining, 3);
});

test("normalise une licence payante en Standard", () => {
  const result = normalizeEntitlement({
    valid: true,
    subscription: { status: "active", plan: "standard" },
  });
  assert.equal(result.status, GateStatus.STANDARD);
  assert.equal(result.label, "Standard");
});

test("ne donne pas accès à un abonnement non valide", () => {
  const result = normalizeEntitlement({
    valid: false,
    reason: "PAYMENT_PENDING",
    subscription: { status: "pending" },
  });
  assert.equal(result.status, GateStatus.BLOCKED);
  assert.equal(result.reason, "PAYMENT_PENDING");
});

test("un cache local active ne remplace pas la validation Hub", () => {
  const result = normalizeEntitlement({
    valid: false,
    subscription: { status: "active", plan: "standard" },
  });
  assert.equal(result.status, GateStatus.BLOCKED);
});

test("retourne des erreurs auth explicites", () => {
  assert.equal(
    authFeedback({ code: "WRONG_PASSWORD" }),
    "Vérifiez votre mot de passe.",
  );
  assert.equal(
    authFeedback({ code: "ACCOUNT_NOT_FOUND" }),
    "Vérifiez votre email et mot de passe.",
  );
  assert.match(
    authFeedback({ code: "INVALID_EMAIL" }),
    /Email invalide/,
  );
});

test("accepte les alias de champs de formulaires existants", () => {
  const creds = credentialsFromForm({
    nom: "Awa Ndiaye",
    mail: "awa@example.com",
    telephone: "690000000",
    mot_de_passe: "secret12",
  });
  assert.equal(creds.full_name, "Awa Ndiaye");
  assert.equal(creds.email, "awa@example.com");
  assert.equal(creds.phone, "690000000");
  assert.equal(creds.password, "secret12");
});

test("un paiement échoué ou abandonné reste unpaid / bloqué", () => {
  for (const status of ["unpaid", "cancelled", "failed", "abandoned"]) {
    const result = normalizeEntitlement({
      valid: false,
      subscription: { status, plan: "standard" },
    });
    assert.equal(result.status, GateStatus.BLOCKED);
    assert.equal(result.reason, "UNPAID");
  }
});

test("une URL de succès ne donne jamais l'accès Standard", () => {
  assert.equal(accessGrantedFromPaymentReturn(), false);
  assert.equal(accessGrantedFromPaymentReturn({ payment: "success" }), false);
});

test("affiche le message réseau exigé", () => {
  assert.equal(isNetworkError({ name: "TypeError", message: "Failed to fetch" }), true);
  assert.equal(authFeedback({ name: "TypeError", message: "Failed to fetch" }), NETWORK_ERROR_MESSAGE);
  assert.equal(
    NETWORK_ERROR_MESSAGE,
    "Erreur de connexion, vérifiez votre connexion internet",
  );
});

test("message d'interception licence exact", () => {
  assert.equal(
    NO_LICENSE_MESSAGE,
    "Ce compte n'a pas de licence, veuillez acheter une licence ou bénéficier de l'essai gratuit",
  );
});

test("masque les actions obsolètes renouveler la licence", () => {
  const button = { textContent: "Renouveler la licence", hidden: false, setAttribute() {}, getAttribute() { return null; } };
  const root = { querySelectorAll() { return [button]; } };
  const hidden = hideObsoleteRenewActions(root);
  assert.equal(hidden.length, 1);
  assert.equal(button.hidden, true);
});
