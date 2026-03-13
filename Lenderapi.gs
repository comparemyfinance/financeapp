/**
 * Lenderapi.gs (placeholder-preparation, Pattern B-lite)
 * ------------------------------------------------------
 * Mirrors the CURRENT UI lender list + defaults and uses the SAME calculation approach
 * as CMF_WHATSAPP_IMPORT_FIXED_v4.html (Product Sourcing):
 *   - balloon = settlementFigure * getBalloonPerc(term, origLoan) * (highlight multiplier)
 *   - monthly = calcMonthly(settlementFigure, term, apr, balloon)
 *   - totalPayable = monthly * term + balloon
 *   - commission = settlementFigure * (commissionPct/100)
 *
 * NOTE: This is placeholder mode only; no live lender calls yet.
 */


function getLenderCapabilities_() {
  var defaults = getLenderDefaults_();
  var capabilities = {};

  for (var i = 0; i < defaults.length; i++) {
    var lenderName = defaults[i].lender;
    capabilities[lenderName] = {
      lenderId: lenderName,
      displayName: lenderName,
      validationProvider: "JigsawRules",
      submissionProvider: "SimulatedSuccess",
      supportsApply: true,
      supportsValidate: true,
      isLiveSubmission: false,
    };
  }

  capabilities.Jigsaw = {
    lenderId: "Jigsaw",
    displayName: "Jigsaw",
    validationProvider: "JigsawRules",
    submissionProvider: "JigsawLive",
    supportsApply: true,
    supportsValidate: true,
    isLiveSubmission: true,
  };

  capabilities.CarMoney = {
    lenderId: "CarMoney",
    displayName: "CarMoney",
    validationProvider: "JigsawRules",
    submissionProvider: "SimulatedSuccess",
    supportsApply: true,
    supportsValidate: true,
    isLiveSubmission: false,
  };

  capabilities.CF247 = {
    lenderId: "CF247",
    displayName: "CF247",
    validationProvider: "JigsawRules",
    submissionProvider: "SimulatedSuccess",
    supportsApply: true,
    supportsValidate: true,
    isLiveSubmission: false,
  };

  return capabilities;
}

function getLenderCapability_(selectedLender) {
  var capabilities = getLenderCapabilities_();
  var lenderName = String(selectedLender || "").trim();

  if (capabilities[lenderName]) return capabilities[lenderName];

  var normalized = toLenderKey_(lenderName);
  var keys = Object.keys(capabilities);
  for (var i = 0; i < keys.length; i++) {
    if (toLenderKey_(keys[i]) === normalized) return capabilities[keys[i]];
  }

  return {
    lenderId: lenderName || "Unknown",
    displayName: lenderName || "Unknown",
    validationProvider: "JigsawRules",
    submissionProvider: "SimulatedSuccess",
    supportsApply: true,
    supportsValidate: true,
    isLiveSubmission: false,
  };
}

function resolveValidationProvider_(selectedLender) {
  return getLenderCapability_(selectedLender).validationProvider;
}

function resolveSubmissionProvider_(selectedLender) {
  return getLenderCapability_(selectedLender).submissionProvider;
}


function validateWithProvider_(providerId, payload) {
  var provider = String(providerId || "").trim();
  if (provider === "JigsawRules") {
    return validateWithJigsawRulesPlaceholder_(payload || {});
  }
  return {
    success: false,
    code: "UNKNOWN_VALIDATION_PROVIDER",
    message: "Unsupported validation provider: " + provider,
  };
}

function submitWithProvider_(providerId, payload) {
  var provider = String(providerId || "").trim();
  if (provider === "JigsawLive") {
    // Guardrail placeholder: only selected lender Jigsaw may ever use this provider.
    if (String(payload && payload.selectedLender || "") !== "Jigsaw") {
      return {
        success: false,
        code: "LIVE_PROVIDER_BLOCKED",
        message: "Only Jigsaw can use JigsawLive submission provider",
      };
    }
    return {
      success: false,
      code: "SUBMIT_NOT_ACTIVE",
      message: "Submit is not active in Product Source modal yet",
    };
  }
  if (provider === "SimulatedSuccess") {
    return {
      success: true,
      mode: "placeholder",
      message: "Simulated submit success",
    };
  }
  return {
    success: false,
    code: "UNKNOWN_SUBMISSION_PROVIDER",
    message: "Unsupported submission provider: " + provider,
  };
}

function validateLenderApplication_(payload) {
  payload = payload || {};
  var selectedLender = String(
    payload.selectedLender || payload.lender || payload.lenderName || "",
  ).trim();
  if (!selectedLender) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      message: "selectedLender is required",
    };
  }

  var capability = getLenderCapability_(selectedLender);
  var validationProvider = resolveValidationProvider_(selectedLender);
  var providerResult = validateWithProvider_(validationProvider, {
    selectedLender: selectedLender,
    capability: capability,
    deal: payload.deal || null,
    draft: payload.draft || null,
    rawPayload: payload,
  });

  return {
    success: !!providerResult.success,
    selectedLender: selectedLender,
    validationProvider: validationProvider,
    submissionProvider: capability.submissionProvider,
    statusMessage: providerResult.success
      ? selectedLender + " validation successful"
      : selectedLender + " validation failed",
    result: providerResult,
  };
}

function validateWithJigsawRulesPlaceholder_(ctx) {
  var deal = ctx && (ctx.deal || null);
  if (!deal || typeof deal !== "object") {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Missing deal payload",
      errors: ["deal payload is required"],
    };
  }

  return {
    success: true,
    mode: "placeholder",
    ruleProvider: "JigsawRules",
    message: "Validation passed",
    warnings: [],
  };
}

function listLenders_() {
  return getLenderDefaults_().map(function (x) {
    return {
      lenderKey: toLenderKey_(x.lender),
      lender: x.lender,
      apr: x.apr,
      commissionPct: x.commissionPct,
      highlight: x.highlight,
    };
  });
}

function getLenderQuote(payload) {
  payload = payload || {};
  var lenderKey = String(payload.lenderKey || payload.lender || "").trim();
  var settlementFigure = toNumber_(payload.settlementFigure);
  var remainingTerm = toInt_(payload.remainingTerm);
  var origLoan = toNumber_(payload.origLoan);

  if (!lenderKey) return { success: false, error: "lenderKey required" };
  if (!isFinite(settlementFigure) || settlementFigure <= 0)
    return { success: false, error: "settlementFigure required" };
  if (!isFinite(remainingTerm) || remainingTerm <= 0)
    return { success: false, error: "remainingTerm required" };
  if (!isFinite(origLoan) || origLoan <= 0)
    return { success: false, error: "origLoan required" };

  var defaults = getLenderDefaults_();
  var keyNorm = toLenderKey_(lenderKey);
  var lenderDef = null;
  for (var i = 0; i < defaults.length; i++) {
    if (toLenderKey_(defaults[i].lender) === keyNorm) {
      lenderDef = defaults[i];
      break;
    }
  }
  if (!lenderDef) {
    // Unknown lender: return a safe placeholder with no overrides
    return {
      success: true,
      lenderKey: keyNorm,
      mode: "placeholder",
      quoteInputs: {},
      quoteOutputs: {},
      reasons: ["unknown_lender_key"],
      raw: {},
    };
  }

  var product = computeProduct_(
    lenderDef,
    settlementFigure,
    remainingTerm,
    origLoan,
  );

  return {
    success: true,
    lenderKey: toLenderKey_(lenderDef.lender),
    mode: "placeholder",
    quoteInputs: {
      apr: lenderDef.apr,
      commissionPct: lenderDef.commissionPct,
      balloon: product.calculatedBalloonPayment,
    },
    quoteOutputs: {
      lender: product.lender,
      term: product.term,
      calculatedMonthlyPayment: product.calculatedMonthlyPayment,
      calculatedBalloonPayment: product.calculatedBalloonPayment,
      calculatedCommission: product.calculatedCommission,
      totalPayable: product.totalPayable,
    },
    reasons: [],
    raw: {},
  };
}

function getLenderQuotesBatch(payload) {
  payload = payload || {};
  var settlementFigure = toNumber_(payload.settlementFigure);
  var remainingTerm = toInt_(payload.remainingTerm);
  var origLoan = toNumber_(payload.origLoan);
  var financeType = String(payload.financeType || "").toUpperCase();

  if (!isFinite(settlementFigure) || settlementFigure <= 0)
    return { success: false, error: "settlementFigure required" };
  if (!isFinite(remainingTerm) || remainingTerm <= 0)
    return { success: false, error: "remainingTerm required" };
  if (!isFinite(origLoan) || origLoan <= 0)
    return { success: false, error: "origLoan required" };

  var defaults = getLenderDefaults_();
  var products = defaults.map(function (def) {
    return computeProduct_(
      def,
      settlementFigure,
      remainingTerm,
      origLoan,
      financeType,
    );
  });

  // Mirror UI sort: ascending APR
  products.sort(function (a, b) {
    return a.apr - b.apr;
  });

  return {
    success: true,
    mode: "placeholder",
    settlementFigure: settlementFigure,
    remainingTerm: remainingTerm,
    origLoan: origLoan,
    products: products,
    lenders: listLenders_(),
  };
}

function computeProduct_(
  lenderDef,
  settlementFigure,
  remainingTerm,
  origLoan,
  financeType,
) {
  // Same as UI: base balloon uses settlementFigure and term/origLoan curve
  var baseBalloon = settlementFigure * getBalloonPerc_(remainingTerm, origLoan);

  // Same as UI highlight multipliers
  var v = 1.0;
  if (lenderDef.highlight) {
    if (lenderDef.lender === "Alphera") v = 1.05;
    else if (lenderDef.lender === "Motonovo") v = 0.98;
    else if (lenderDef.lender === "Northridge Finance") v = 1.1;
  }

  // Product Source migration placeholder rule:
  // - Jigsaw/CarMoney/CF247 must use best comparative PCP balloon only.
  // - HP rows do not receive balloon manipulation.
  if (
    isProductSourcePriorityLender_(lenderDef.lender) &&
    String(financeType || "").toUpperCase() === "PCP"
  ) {
    v = 1.2;
  }
  var balloon = baseBalloon * v;

  var commission = settlementFigure * (lenderDef.commissionPct / 100);
  var monthly = calcMonthly_(
    settlementFigure,
    remainingTerm,
    lenderDef.apr,
    balloon,
  );
  var total = monthly * remainingTerm + balloon;

  return {
    lenderKey: toLenderKey_(lenderDef.lender),
    lender: lenderDef.lender,
    apr: lenderDef.apr,
    commissionPct: lenderDef.commissionPct,
    term: remainingTerm,
    calculatedMonthlyPayment: monthly,
    calculatedBalloonPayment: balloon,
    calculatedCommission: commission,
    totalPayable: total,
  };
}

// === UI-MIRROR CALCS (keep in sync with v4 HTML) ===

function getBalloonPerc_(term, price) {
  term = Math.max(0, toInt_(term));
  price = toNumber_(price);
  if (term <= 0 || !isFinite(price) || price <= 0) return 0;
  var dp = [
    { m: 24, p: 0.5865 },
    { m: 37, p: 0.5352 },
    { m: 49, p: 0.4542 },
    { m: 60, p: 0.3597 },
  ];
  if (term <= dp[0].m) return dp[0].p;
  if (term >= dp[dp.length - 1].m) return dp[dp.length - 1].p;
  var lb = dp[0],
    ub = dp[dp.length - 1];
  for (var i = 0; i < dp.length - 1; i++) {
    if (term >= dp[i].m && term <= dp[i + 1].m) {
      lb = dp[i];
      ub = dp[i + 1];
      break;
    }
  }
  return lb.p + ((term - lb.m) * (ub.p - lb.p)) / (ub.m - lb.m);
}

function calcMonthly_(p, t, apr, b) {
  p = toNumber_(p);
  t = toInt_(t);
  apr = toNumber_(apr);
  b = toNumber_(b);
  if (t <= 0) return 0;
  var r = apr / 100 / 12;
  if (r === 0) return (p - b) / t;
  var n = p - b / Math.pow(1 + r, t);
  var d = (1 - Math.pow(1 + r, -t)) / r;
  return n / d;
}

// === LENDER DEFAULTS (MUST MATCH UI lenderData) ===

function getLenderDefaults_() {
  return [
    {
      lender: "Jigsaw",
      apr: 1.0,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "CarMoney",
      apr: 1.0,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "CF247",
      apr: 1.0,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "BNP Paribas Finance",
      apr: 12.9,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Motonovo",
      apr: 11.9,
      commissionPct: 4,
      highlight: true,
    },
    {
      lender: "V12",
      apr: 15.9,
      commissionPct: 5,
      highlight: false,
    },
    {
      lender: "Close Brothers",
      apr: 12.9,
      commissionPct: 4.5,
      highlight: false,
    },
    {
      lender: "Credit Agricole",
      apr: 14.0,
      commissionPct: 3,
      highlight: false,
    },
    {
      lender: "Northridge Finance",
      apr: 9.9,
      commissionPct: 3.5,
      highlight: true,
    },
    {
      lender: "Alphera",
      apr: 10.9,
      commissionPct: 4,
      highlight: true,
    },
    {
      lender: "Zopa",
      apr: 17.9,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Advantage Finance",
      apr: 31.4,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Automoney",
      apr: 28.0,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Moneybarn",
      apr: 33.7,
      commissionPct: 2.6,
      highlight: false,
    },
    {
      lender: "Moneyway",
      apr: 26.65,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Oodle",
      apr: 23.1,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Lendable",
      apr: 29.8,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Startline Finance",
      apr: 24.3,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Tandem",
      apr: 22.25,
      commissionPct: 4,
      highlight: false,
    },
    {
      lender: "Billing Finance",
      apr: 35.4,
      commissionPct: 1.3,
      highlight: false,
    },
  ];
}

// === Helpers ===

function toLenderKey_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function toNumber_(v) {
  var n = Number(v);
  return isFinite(n) ? n : NaN;
}

function toInt_(v) {
  var n = parseInt(v, 10);
  return isFinite(n) ? n : NaN;
}

/**
 * Placeholder FINANCE NAVIGATOR soft-score simulation.
 * Deterministic by client + lender so results are stable per client.
 */
function getFinanceNavigatorSoftScore(payload) {
  payload = payload || {};
  var lendersFromPayload = Array.isArray(payload.lenders)
    ? payload.lenders
    : [];
  var defaults = getLenderDefaults_();
  var lenders = lendersFromPayload.length
    ? lendersFromPayload
    : defaults.map(function (def) {
        return {
          lenderId: toLenderKey_(def.lender),
          lenderName: def.lender,
          baseApr: def.apr,
        };
      });

  var clientScore = toInt_(payload.clientScore);
  if (!isFinite(clientScore)) {
    var scoreRnd = seededNumber_(
      (payload.clientId || payload.quoteId || payload.vrn || "anon") +
        "|client-score",
    );
    clientScore = Math.round(35 + scoreRnd * 55);
  }
  clientScore = Math.max(0, Math.min(100, clientScore));

  var clientSeed = [
    payload.clientId || "",
    payload.quoteId || "",
    payload.vrn || "",
    clientScore,
  ].join("|");
  var offers = lenders.map(function (entry, idx) {
    var lenderName = entry.lenderName || entry.lender || "";
    var lenderId = normalizeLenderId_(
      entry.lenderId || entry.lenderKey || lenderName || "lender-" + idx,
    );
    var rand = seededNumber_(clientSeed + "|" + lenderId);
    var rand2 = seededNumber_(clientSeed + "|" + lenderId + "|a");
    var rand3 = seededNumber_(clientSeed + "|" + lenderId + "|d");

    if (isProductSourcePriorityLenderId_(lenderId, lenderName)) {
      return {
        lenderId: lenderId,
        lenderName: lenderName,
        aprOffer: 1.0,
        decision: "accept",
        acceptanceScore: 90,
        acceptanceLabel: "High",
      };
    }

    var baseApr = toNumber_(entry.baseApr);
    if (!isFinite(baseApr)) {
      var found = defaults.filter(function (def) {
        return toLenderKey_(def.lender) === lenderId;
      })[0];
      baseApr = found ? found.apr : 12.9;
    }
    // Lender appetite model (placeholder):
    // - Prime lenders (lower APR) are stricter for weaker clients.
    // - Higher-APR lenders are generally more accepting, especially for weaker clients.
    var primeStrictness = Math.max(0, Math.min(1, (14 - baseApr) / 8));
    var subprimeAppetite = Math.max(0, Math.min(1, (baseApr - 16) / 16));
    var highClientBoost = clientScore >= 75 ? 8 : (clientScore >= 60 ? 4 : 0);
    var lowClientPenaltyAtPrime = (clientScore < 60 ? 11 : 6) * primeStrictness;
    var lowClientSupportAtHighApr = (clientScore < 60 ? 12 : 6) * subprimeAppetite;

    var acceptanceScore = Math.max(
      3,
      Math.min(
        97,
        Math.round(
          clientScore +
            (rand - 0.5) * 22 +
            highClientBoost +
            lowClientSupportAtHighApr -
            lowClientPenaltyAtPrime,
        ),
      ),
    );

    // Higher-APR lenders should be less likely to hard-decline near the lower edge.
    var declineThreshold = Math.max(8, 18 - Math.round(subprimeAppetite * 8));
    var declineChance = Math.max(0.2, 0.7 - subprimeAppetite * 0.25);
    var decline = acceptanceScore < declineThreshold && rand3 < declineChance;
    var aprOffer = null;
    if (!decline) {
      var aprShift = (rand2 - 0.45) * (clientScore >= 70 ? 2.2 : 4.8);
      aprOffer = Math.max(3.9, Math.ceil((baseApr + aprShift) * 10) / 10);
    }

    return {
      lenderId: lenderId,
      lenderName: lenderName,
      aprOffer: aprOffer,
      decision: decline ? "decline" : "accept",
      acceptanceScore: acceptanceScore,
      acceptanceLabel: acceptanceLabelFromScore_(acceptanceScore),
    };
  });

  return {
    success: true,
    mode: "placeholder",
    source: "finance-navigator-sim",
    clientSeed: clientSeed,
    clientScore: clientScore,
    offers: offers,
  };
}

function normalizeLenderId_(name) {
  return String(name || "")
    .toLowerCase()
    .replace(
      /\b(ltd|limited|plc|finance|financial|consumer|bank|group|services|uk)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function seededNumber_(seed) {
  var str = String(seed || "seed");
  var h = 2166136261;
  for (var idx = 0; idx < str.length; idx++) {
    h ^= str.charCodeAt(idx);
    h = Math.imul(h, 16777619);
  }
  var state = h >>> 0 || 1;
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 4294967296;
}

function acceptanceLabelFromScore_(score) {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  if (score >= 30) return "Low";
  return "Very Low";
}

function isProductSourcePriorityLender_(lenderName) {
  var key = toLenderKey_(lenderName);
  return key === "jigsaw" || key === "carmoney" || key === "cf247";
}

function isProductSourcePriorityLenderId_(lenderId, lenderName) {
  return (
    isProductSourcePriorityLender_(lenderId) ||
    isProductSourcePriorityLender_(lenderName)
  );
}
