import env from '../config/env.js';
import logger from '../utils/logger.js';

const MODERATION_API_URL = 'https://api.openai.com/v1/moderations';

const FLAGGED_CATEGORIES = [
  'hate',
  'hate/threatening',
  'self-harm',
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
];

let creditsWarningShown = false;

export async function moderateText(text) {
  if (!env.OPENAI_API_KEY) {
    return { approved: true };
  }

  if (creditsWarningShown) {
    return { approved: true };
  }

  if (!text || text.trim().length === 0) {
    return { approved: true };
  }

  try {
    const response = await fetch(MODERATION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        creditsWarningShown = true;
        logger.warn('OpenAI account has no credits — moderation disabled. Add credits at https://platform.openai.com/settings/organization/billing');
      } else {
        logger.error({ status: response.status }, 'Moderation API request failed');
      }
      return { approved: true };
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
      return { approved: true };
    }

    if (result.flagged) {
      const flaggedCategories = FLAGGED_CATEGORIES.filter(
        (cat) => result.categories[cat]
      );

      logger.warn({ flaggedCategories, text: text.substring(0, 100) }, 'Content flagged by moderation');

      return {
        approved: false,
        reasons: flaggedCategories,
      };
    }

    return { approved: true };
  } catch (err) {
    logger.error({ err }, 'Moderation API error — failing open');
    return { approved: true };
  }
}

export async function moderateFields(fields) {
  const textsToCheck = Object.entries(fields)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  return moderateText(textsToCheck);
}
