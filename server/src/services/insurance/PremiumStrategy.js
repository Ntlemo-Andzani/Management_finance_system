/**
 * STRATEGY design pattern — credit life premium calculation.
 *
 * The same shape as the interest strategies in ../interest. A product decides
 * how its cover behaves over the life of the loan, and each behaviour is an
 * interchangeable object exposing one method:
 *
 *      price({ principal, termMonths, ratePct })
 *          -> { premium, coverAmount, coverMethod, basis }
 *
 * Adding a new insurance product — a funeral rider, say — means adding one
 * class and registering it, with nothing existing to change.
 */
const { round2 } = require('../../utils/money');

/** Format a figure the way it is read back to the client at the counter. */
const rand = (n) => `R${Number(n).toLocaleString('en-ZA', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;

class PremiumStrategy {
  get name() { return 'abstract'; }

  // eslint-disable-next-line no-unused-vars
  price(_params) {
    throw new Error('price() must be implemented by a concrete strategy');
  }
}

/**
 * NO COVER — the product is not insured. Returned rather than null so callers
 * never branch on absence (Null Object).
 */
class NoCoverStrategy extends PremiumStrategy {
  get name() { return 'none'; }

  price() {
    return { premium: 0, coverAmount: 0, coverMethod: 'flat', basis: 'This product carries no credit life cover' };
  }
}

/**
 * FLAT COVER — the sum assured stays at the full amount repayable for the whole
 * term. Simple to explain at the counter, and because cover does not fall as the
 * client repays, a late claim clears the loan and leaves a surplus for the
 * family.
 */
class FlatCoverStrategy extends PremiumStrategy {
  get name() { return 'flat'; }

  price({ principal, termMonths, ratePct, totalPayable }) {
    const years = termMonths / 12;
    // Cover is the full amount repayable, so a death claim clears the loan
    // outright rather than leaving the family with the interest to find.
    const cover = round2(totalPayable || principal);
    return {
      premium: round2(cover * (ratePct / 100) * years),
      coverAmount: cover,
      coverMethod: 'flat',
      basis: `${ratePct}% a year on cover of ${rand(cover)}, fixed for the full ${termMonths}-month term`,
    };
  }
}

/**
 * DECLINING COVER — the sum assured tracks the outstanding balance, so cover
 * falls as the client repays. Because average exposure over a level-amortising
 * loan is a little over half the principal, the premium is charged on that
 * average rather than the full amount, which makes it materially cheaper.
 */
class DecliningCoverStrategy extends PremiumStrategy {
  get name() { return 'declining'; }

  price({ principal, termMonths, ratePct, totalPayable }) {
    const years = termMonths / 12;
    const cover = round2(totalPayable || principal);
    // Average outstanding balance of a level-amortising loan over n periods.
    const periods = Math.max(1, Math.round(termMonths));
    const averageExposure = round2(cover * ((periods + 1) / (2 * periods)));
    return {
      premium: round2(averageExposure * (ratePct / 100) * years),
      coverAmount: cover,
      coverMethod: 'declining',
      basis: `${ratePct}% a year on an average exposure of ${rand(averageExposure)}, cover follows the outstanding balance`,
    };
  }
}

const strategies = {
  none: new NoCoverStrategy(),
  flat: new FlatCoverStrategy(),
  declining: new DecliningCoverStrategy(),
};

function getPremiumStrategy(method) {
  const strategy = strategies[method || 'none'];
  if (!strategy) throw new Error(`Unknown insurance method: ${method}`);
  return strategy;
}

module.exports = {
  PremiumStrategy,
  NoCoverStrategy,
  FlatCoverStrategy,
  DecliningCoverStrategy,
  getPremiumStrategy,
  strategies,
};
