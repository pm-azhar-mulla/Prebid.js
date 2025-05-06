/* eslint-disable no-unused-vars */
/* eslint-disable no-restricted-properties */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable no-restricted-globals */
import { submodule } from '../src/hook.js';
import { logError, mergeDeep, logMessage } from '../src/utils.js';
/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

const CONSTANTS = Object.freeze({
  SUBMODULE_NAME: 'chromeAi',
  REAL_TIME_MODULE: 'realTimeData',
  LOG_PRE_FIX: 'ChromeAI-Rtd-Provider: ',
  STORAGE_KEY: 'chromeAi_iabCategories',
  SENTIMENT_STORAGE_KEY: 'chromeAi_sentiment'
});

/**
 * Check if IAB categories exist in localStorage for the current URL
 * @returns {Object|null} The IAB categories if found, null otherwise
 */
const isIabCategoryInLocalStorage = () => {
  const currentUrl = window.location.href;
  const storedCategoriesJson = localStorage.getItem(CONSTANTS.STORAGE_KEY);

  if (storedCategoriesJson) {
    try {
      const categoriesObject = JSON.parse(storedCategoriesJson);
      if (categoriesObject[currentUrl]) {
        return categoriesObject[currentUrl];
      }
    } catch (e) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Error parsing localStorage:`, e);
    }
  }

  return null;
};

/**
 * Get text summary using Chrome AI Summarizer API
 * @param {Object} options - Configuration options for the summarizer
 * @returns {Promise<string|null>} - The summary text or null if summarization fails
 */
const getPageSummary = async (options) => {
  try {
    const availability = await Summarizer.availability();
    let summarizer;
    logMessage(`${CONSTANTS.LOG_PRE_FIX} summarizer api status:`, availability);
    console.time("summarizerApiTime");

    if (availability === 'unavailable') {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Summarizer API isn't available`);
      return null;
    }
    if (availability === 'available') {
      // The Summarizer API can be used immediately .
      summarizer = await Summarizer.create(options);
    } else {
      // The Summarizer API can be used after the model is downloaded.
      summarizer = await Summarizer.create(options);
      summarizer.addEventListener('downloadprogress', (e) => {
        console.log(`${CONSTANTS.LOG_PRE_FIX} Download progress:`, e.loaded, e.total);
      });
      await summarizer.ready;
    }

    const longText = document.querySelector('body').innerText;
    const summary = await summarizer.summarize(longText, {
      context: 'This a long html page, you need to ignore the HTML tags such as <p> <article> <div> and only get the text for summarizing',
    });

    console.timeEnd("summarizerApiTime");
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Summary >> `, summary);
    return summary;
  } catch (error) {
    logError(`${CONSTANTS.LOG_PRE_FIX} Error getting page summary:`, error);
    return null;
  }
};

/**
 * Store IAB categories in localStorage
 * @param {Array} iabCategories - The IAB categories to store
 * @param {string} url - The URL to associate with these categories
 * @returns {boolean} - Whether the operation was successful
 */
const storeIabCategories = (iabCategories, url) => {
  try {
    if (!iabCategories || iabCategories.length === 0) {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} No valid IAB categories to store`);
      return false;
    }

    // Get existing categories object or create a new one
    let categoriesObject = {};
    const storedCategoriesJson = localStorage.getItem(CONSTANTS.STORAGE_KEY);

    if (storedCategoriesJson) {
      categoriesObject = JSON.parse(storedCategoriesJson);
    }

    // Store the result in the categories object
    categoriesObject[url] = iabCategories;

    // Save the updated object back to localStorage
    localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(categoriesObject));
    logMessage(`${CONSTANTS.LOG_PRE_FIX} IAB Categories stored in localStorage:`, iabCategories);

    return true;
  } catch (error) {
    logError(`${CONSTANTS.LOG_PRE_FIX} Error storing IAB categories:`, error);
    return false;
  }
};

/**
 * Detect the language of a text using Chrome AI language detection API
 * @param {string} text - The text to detect language for
 * @returns {Promise<string|null>} - The detected language code or null if detection fails
 */
const detectLanguage = async (text) => {
  try {
    // Check if language detection API is available
    if (!LanguageDetector) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Language detection API is not available`);
      return null;
    }

    // Check capabilities
    const languageDetectorAvailability = await LanguageDetector.availability();
    // const canDetect = languageDetectorAvailability.available;

    if (languageDetectorAvailability === 'unavailable') {
      // The language detector isn't usable
      logError(`${CONSTANTS.LOG_PRE_FIX} Language detector is not available`);
      return null;
    }

    let detector;
    if (languageDetectorAvailability === 'available') {
      // The language detector can immediately be used
      detector = await LanguageDetector.create();
    } else {
      // The language detector can be used after model download
      detector = await LanguageDetector.create({
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            logMessage(`${CONSTANTS.LOG_PRE_FIX} Language detector download progress: ${e.loaded} of ${e.total} bytes`);
          });
        },
      });
      await detector.ready;
    }

    // Detect language
    const results = await detector.detect(text);

    if (!results || results.length === 0) {
      logError(`${CONSTANTS.LOG_PRE_FIX} No language detection results`);
      return null;
    }

    const topResult = results[0];
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Detected language: ${topResult.detectedLanguage} (confidence: ${topResult.confidence})`);
    return topResult.detectedLanguage;
  } catch (error) {
    logError(`${CONSTANTS.LOG_PRE_FIX} Error detecting language:`, error);
    return null;
  }
};

/**
 * Translate text to English using Chrome AI translation API
 * @param {string} text - The text to translate
 * @param {string} sourceLanguage - The source language code
 * @returns {Promise<string|null>} - The translated text or null if translation fails
 */
const translateToEnglish = async (text, sourceLanguage) => {
  try {
    // Check if translation API is available
    if (!Translator) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Translation API is not available`);
      return null;
    }

    // Check capabilities
    const translatorAvailability = await Translator.availability({
      sourceLanguage: sourceLanguage,
      targetLanguage: 'en',
    });
    // const canTranslate = translatorAvailability.available;

    if (translatorAvailability === 'unavailable') {
      // The translator isn't usable
      logError(`${CONSTANTS.LOG_PRE_FIX} Translator is not available`);
      return null;
    }

    let translator;
    if (translatorAvailability === 'available') {
      // The translator can immediately be used
      translator = await Translator.create({
        sourceLanguage: sourceLanguage,
        targetLanguage: 'en'
      });
    } else {
      // The translator can be used after model download
      translator = await Translator.create({
        sourceLanguage: sourceLanguage,
        targetLanguage: 'en',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            logMessage(`${CONSTANTS.LOG_PRE_FIX} Translator download progress: ${e.loaded} of ${e.total} bytes`);
          });
        },
      });
      await translator.ready;
    }

    // Translate text
    const result = await translator.translate(text);

    if (!result) {
      logError(`${CONSTANTS.LOG_PRE_FIX} No translation result`);
      return null;
    }

    logMessage(`${CONSTANTS.LOG_PRE_FIX} Translation complete`);
    return result;
  } catch (error) {
    logError(`${CONSTANTS.LOG_PRE_FIX} Error translating text:`, error);
    return null;
  }
};

/**
 * Process summary text: detect language and translate if needed
 * @param {string} summary - The summary text to process
 * @returns {Promise<string|null>} - The processed summary (translated if needed) or null if processing fails
 */
const processSummary = async (summary) => {
  try {
    // Detect language
    const detectedLanguage = await detectLanguage(summary);

    if (!detectedLanguage) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Failed to detect language, using original summary`);
      return summary;
    }

    // If language is not English, translate to English
    if (detectedLanguage.toLowerCase() !== 'en') {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Non-English content detected (${detectedLanguage}), translating to English`);
      const translatedSummary = await translateToEnglish(summary, detectedLanguage);

      if (!translatedSummary) {
        logError(`${CONSTANTS.LOG_PRE_FIX} Translation failed, using original summary`);
        return summary;
      }

      return translatedSummary;
    }

    // If language is English, return original summary
    logMessage(`${CONSTANTS.LOG_PRE_FIX} English content detected, no translation needed`);
    return summary;
  } catch (error) {
    logError(`${CONSTANTS.LOG_PRE_FIX} Error processing summary:`, error);
    return summary; // Return original summary in case of error
  }
};

/**
 * Check if sentiment analysis exists in localStorage for the current URL
 * @returns {Object|null} The sentiment analysis if found, null otherwise
 */
const isSentimentInLocalStorage = () => {
  const currentUrl = window.location.href;
  const storedSentimentJson = localStorage.getItem(CONSTANTS.SENTIMENT_STORAGE_KEY);

  if (storedSentimentJson) {
    try {
      const sentimentObject = JSON.parse(storedSentimentJson);
      if (sentimentObject[currentUrl]) {
        return sentimentObject[currentUrl];
      }
    } catch (e) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Error parsing sentiment from localStorage:`, e);
    }
  }

  return null;
};

/**
 * Store sentiment analysis in localStorage
 * @param {Object} sentiment - The sentiment analysis to store
 * @param {string} url - The URL to associate with this sentiment
 * @returns {boolean} - Whether the operation was successful
 */
const storeSentiment = (sentiment, url) => {
  try {
    // Get existing sentiment data or create new object
    const existingDataJson = localStorage.getItem(CONSTANTS.SENTIMENT_STORAGE_KEY);
    let sentimentObject = {};

    if (existingDataJson) {
      try {
        sentimentObject = JSON.parse(existingDataJson);
      } catch (e) {
        logError(`${CONSTANTS.LOG_PRE_FIX} Error parsing existing sentiment data:`, e);
      }
    }

    // Add new sentiment data for this URL
    sentimentObject[url] = sentiment;

    // Store updated data
    localStorage.setItem(CONSTANTS.SENTIMENT_STORAGE_KEY, JSON.stringify(sentimentObject));
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Sentiment stored for URL:`, url);

    return true;
  } catch (e) {
    logError(`${CONSTANTS.LOG_PRE_FIX} Error storing sentiment:`, e);
    return false;
  }
};

/**
 * Perform sentiment analysis using Chrome AI Prompt API
 * @param {string} text - The text to analyze
 * @returns {Promise<Object|null>} - The sentiment analysis result or null if analysis fails
 */
const analyzeSentiment = async (text) => {
  console.log("Azzi>> tect as input >> ", text);
  try {
    // Check if the Prompt API is available
    if (!LanguageModel) {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Chrome AI Prompt API is not available`);
      return null;
    }

    // Check capabilities
    const availability = await LanguageModel.availability();
    if (availability === 'unavailable') {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Chrome AI Prompt API isn't available`);
      return null;
    }

    logMessage(`${CONSTANTS.LOG_PRE_FIX} Chrome AI Prompt API status:`, availability);
    console.time("sentimentAnalysisTime");

    // Create prompt for sentiment analysis
    const prompt = `
      Analyze the sentiment of the following text. Determine if it is positive, negative, or neutral.
      Also identify the main emotions expressed (like joy, anger, sadness, fear, surprise, etc.) and the overall tone.
      
      Text to analyze:
      "${text}"
      
      Format your response as a JSON object with the following structure:
      {
        "sentiment": "positive|negative|neutral",
        "confidence": [number between 0-1],
        "emotions": ["emotion1", "emotion2"],
        "tone": "formal|informal|technical|casual|etc",
        "intensity": "low|medium|high"
      }
    `;

    // Initialize the prompt API
    let promptApi;
    if (availability === 'available') {
      promptApi = await LanguageModel.create({
        systemPrompt: prompt,
      });
    } else {
      promptApi = await LanguageModel.create({
        systemPrompt: prompt,
      });

      // Monitor download progress if needed
      promptApi.addEventListener('downloadprogress', (e) => {
        logMessage(`${CONSTANTS.LOG_PRE_FIX} Prompt API download progress:`, e.loaded, 'of', e.total);
      });

      await promptApi.ready;
    }

    // Generate the response
    console.log("Azzi prompt>>", promptApi);
    const response = await promptApi.prompt('What is the sentiment analyisis for this page? give me answer in json format as specified in system prompt');
    console.log("response>>", response);
    console.timeEnd("sentimentAnalysisTime");

    // Parse the JSON response
    try {
      // Look for JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const sentimentData = JSON.parse(jsonMatch[0]);
        logMessage(`${CONSTANTS.LOG_PRE_FIX} Sentiment analysis result:`, sentimentData);
        return sentimentData;
      } else {
        logError(`${CONSTANTS.LOG_PRE_FIX} No valid JSON found in prompt response`);
        return null;
      }
    } catch (e) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Error parsing sentiment analysis result:`, e);
      return null;
    }
  } catch (e) {
    logError(`${CONSTANTS.LOG_PRE_FIX} Error during sentiment analysis:`, e);
    console.timeEnd("sentimentAnalysisTime");
    return null;
  }
};

/**
 * Get page content for analysis
 * @returns {string} - The page content
 */
const getPageContent = () => {
  // Get the main content of the page
  // First try to find the main content element
  const mainContent = document.querySelector('body');

  if (mainContent) {
    return mainContent.innerText;
  }

  // If no main content element is found, get all paragraph text
  const paragraphs = document.querySelectorAll('p');
  if (paragraphs.length > 0) {
    return Array.from(paragraphs).map(p => p.innerText).join(' ');
  }

  // Fallback to body text
  return document.body.innerText;
};

/**
 * Initialize the ChromeAI RTD Module.
 * @param {Object} config
 * @param {Object} _userConsent
 * @returns {boolean}
 */
const init = async (config, _userConsent) => {
  logMessage(`${CONSTANTS.LOG_PRE_FIX} config:`, config);

  // Check if IAB categories already exist in localStorage
  const storedCategories = isIabCategoryInLocalStorage();

  if (storedCategories) {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} IAB Categories already in localStorage, skipping mapping`, storedCategories);
    return true;
  }

  // Define summarizer options
  const options = {
    type: 'teaser',
    format: 'markdown',
    length: 'long',
  };

  // Get page summary using Chrome AI
  const summary = await getPageSummary(options);

  if (!summary) {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Failed to get page summary, aborting`);
    return false;
  }

  // Process summary: detect language and translate if needed
  const processedSummary = await processSummary(summary);
  if (!processedSummary) {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Failed to process summary, aborting`);
    return false;
  }

  // Get sentiment analysis using Chrome AI
  const sentiment = await analyzeSentiment(processedSummary);

  // Map the processed summary to IAB categories
  console.time("IABMappingTime");
  const iabCategories = mapToIABCategories(processedSummary);
  console.timeEnd("IABMappingTime");

  // Store categories in localStorage if valid
  if (iabCategories && iabCategories.length > 0) {
    storeIabCategories(iabCategories, window.location.href);
  } else {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} No valid IAB categories found for this page`);
  }

  return true;
};

/**
 * @param {Object} reqBidsConfigObj
 * @param {function} callback
 * @param {Object} config
 * @param {Object} userConsent
 */
const getBidRequestData = (reqBidsConfigObj, callback) => {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} reqBidsConfigObj:`, reqBidsConfigObj);

    // Check if IAB categories exist in localStorage
    const storedCategories = isIabCategoryInLocalStorage();
    if (storedCategories) {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Setting IAB Categories from localStorage:`, storedCategories);
      mergeDeep(reqBidsConfigObj.ortb2Fragments.bidder, {
                    'pubmatic': {
                        site: {
                            ext: storedCategories
                        }
                    }
                });
    } else {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} No IAB Categories found in localStorage for current URL`);
    }
    logMessage(`${CONSTANTS.LOG_PRE_FIX} after changing:`, reqBidsConfigObj);

    callback();
}

/** @type {RtdSubmodule} */
export const chromeAiSubmodule = {
  /**
   * used to link submodule with realTimeData
   * @type {string}
   */
  name: CONSTANTS.SUBMODULE_NAME,
  init,
  getBidRequestData,
};

export const registerSubModule = () => {
  submodule(CONSTANTS.REAL_TIME_MODULE, chromeAiSubmodule);
}

registerSubModule();

const IAB_CATEGORIES = {
    "IAB1": {
      "name": "Arts & Entertainment",
      "subcategories": {"IAB1-1": "Books & Literature", "IAB1-2": "Celebrity Fan/Gossip", "IAB1-3": "Fine Art", "IAB1-4": "Humor", "IAB1-5": "Movies", "IAB1-6": "Music", "IAB1-7": "Television"},
      "keywords": ["entertainment", "art", "movie", "film", "music", "concert", "book", "novel", "celebrity", "actor", "actress", "director", "tv", "television", "show", "theater", "comedy", "drama"]
    },
    "IAB2": {
      "name": "Automotive",
      "subcategories": {"IAB2-1": "Auto Parts", "IAB2-2": "Auto Repair", "IAB2-3": "Buying/Selling Cars"},
      "keywords": ["car", "vehicle", "automotive", "auto", "truck", "suv", "repair", "parts", "dealer", "driving"]
    },
    "IAB3": {
      "name": "Business",
      "subcategories": {"IAB3-1": "Advertising", "IAB3-2": "Agriculture", "IAB3-3": "Biotech/Biomedical"},
      "keywords": ["business", "company", "corporate", "industry", "market", "finance", "investment", "economy", "trade", "stock", "management"]
    },
    "IAB4": {
      "name": "Careers",
      "subcategories": {"IAB4-1": "Career Planning", "IAB4-2": "College", "IAB4-3": "Financial Aid"},
      "keywords": ["job", "career", "employment", "hiring", "resume", "interview", "salary", "profession", "work"]
    },
    "IAB5": {
      "name": "Education",
      "subcategories": {"IAB5-1": "7-12 Education", "IAB5-2": "Adult Education", "IAB5-3": "Art History"},
      "keywords": ["education", "school", "university", "college", "degree", "academic", "learning", "student", "teacher", "professor", "course", "class"]
    },
    "IAB6": {
      "name": "Family & Parenting",
      "subcategories": {"IAB6-1": "Adoption", "IAB6-2": "Babies & Toddlers", "IAB6-3": "Daycare/Pre School"},
      "keywords": ["family", "parent", "child", "baby", "kid", "mother", "father", "pregnancy", "toddler", "parenting"]
    },
    "IAB7": {
      "name": "Health & Fitness",
      "subcategories": {"IAB7-1": "Exercise", "IAB7-2": "A.D.D.", "IAB7-3": "AIDS/HIV"},
      "keywords": ["health", "fitness", "exercise", "workout", "diet", "nutrition", "medical", "disease", "doctor", "hospital", "medicine", "wellness"]
    },
    "IAB8": {
      "name": "Food & Drink",
      "subcategories": {"IAB8-1": "American Cuisine", "IAB8-2": "Barbecues & Grilling", "IAB8-3": "Cajun/Creole"},
      "keywords": ["food", "drink", "recipe", "cooking", "cuisine", "restaurant", "chef", "meal", "dinner", "lunch", "breakfast", "baking", "grill"]
    },
    "IAB9": {
      "name": "Hobbies & Interests",
      "subcategories": {"IAB9-1": "Art/Technology", "IAB9-2": "Arts & Crafts", "IAB9-3": "Beadwork"},
      "keywords": ["hobby", "craft", "collection", "diy", "gardening", "photography", "sewing", "knitting", "woodworking", "interest"]
    },
    "IAB10": {
      "name": "Home & Garden",
      "subcategories": {"IAB10-1": "Appliances", "IAB10-2": "Entertaining", "IAB10-3": "Environmental Safety"},
      "keywords": ["home", "house", "garden", "furniture", "decor", "interior", "design", "decoration", "gardening", "landscaping", "lawn", "appliance"]
    },
    "IAB11": {
      "name": "Law, Gov't & Politics",
      "subcategories": {"IAB11-1": "Immigration", "IAB11-2": "Legal Issues", "IAB11-3": "Government"},
      "keywords": ["law", "legal", "government", "politics", "policy", "election", "vote", "political", "president", "congress", "court", "legislation"]
    },
    "IAB12": {
      "name": "News",
      "subcategories": {"IAB12-1": "International News", "IAB12-2": "National News", "IAB12-3": "Local News"},
      "keywords": ["news", "headline", "report", "journalist", "media", "press", "breaking", "current events", "update"]
    },
    "IAB13": {
      "name": "Personal Finance",
      "subcategories": {"IAB13-1": "Beginning Investing", "IAB13-2": "Credit/Debt & Loans", "IAB13-3": "Financial News"},
      "keywords": ["finance", "money", "invest", "loan", "credit", "debt", "mortgage", "banking", "budget", "saving", "retirement"]
    },
    "IAB14": {
      "name": "Society",
      "subcategories": {"IAB14-1": "Dating", "IAB14-2": "Divorce Support", "IAB14-3": "Gay Life"},
      "keywords": ["society", "culture", "community", "relationship", "dating", "wedding", "marriage", "divorce", "social"]
    },
    "IAB15": {
      "name": "Science",
      "subcategories": {"IAB15-1": "Astrology", "IAB15-2": "Biology", "IAB15-3": "Chemistry"},
      "keywords": ["science", "research", "scientific", "biology", "chemistry", "physics", "astronomy", "technology", "experiment", "discovery"]
    },
    "IAB16": {
      "name": "Pets",
      "subcategories": {"IAB16-1": "Aquariums", "IAB16-2": "Birds", "IAB16-3": "Cats"},
      "keywords": ["pet", "dog", "cat", "animal", "veterinarian", "breed", "fish", "bird", "reptile", "hamster"]
    },
    "IAB17": {
      "name": "Sports",
      "subcategories": {"IAB17-1": "Auto Racing", "IAB17-2": "Baseball", "IAB17-3": "Bicycling", "IAB17-4": "Bodybuilding", "IAB17-5": "Boxing", "IAB17-6": "Canoeing/Kayaking", "IAB17-7": "Cheerleading", "IAB17-8": "Climbing", "IAB17-9": "Cricket", "IAB17-10": "Figure Skating", "IAB17-11": "Fly Fishing", "IAB17-12": "Football", "IAB17-13": "Freshwater Fishing", "IAB17-14": "Game & Fish", "IAB17-15": "Golf", "IAB17-16": "Horse Racing", "IAB17-17": "Horses", "IAB17-18": "Hunting/Shooting", "IAB17-19": "Inline Skating", "IAB17-20": "Martial Arts", "IAB17-21": "Mountain Biking", "IAB17-22": "NASCAR Racing", "IAB17-23": "Olympics", "IAB17-24": "Paintball", "IAB17-25": "Power & Motorcycles", "IAB17-26": "Pro Basketball", "IAB17-27": "Pro Ice Hockey", "IAB17-28": "Rodeo", "IAB17-29": "Rugby", "IAB17-30": "Running/Jogging", "IAB17-31": "Sailing", "IAB17-32": "Saltwater Fishing", "IAB17-33": "Scuba Diving", "IAB17-34": "Skateboarding", "IAB17-35": "Skiing", "IAB17-36": "Snowboarding", "IAB17-37": "Surfing/Bodyboarding", "IAB17-38": "Swimming", "IAB17-39": "Table Tennis/Ping-Pong", "IAB17-40": "Tennis", "IAB17-41": "Volleyball", "IAB17-42": "Walking", "IAB17-43": "Waterski/Wakeboard", "IAB17-44": "World Soccer"},
      "keywords": ["sport", "game", "team", "player", "athlete", "championship", "tournament", "match", "competition", "league", "score", "win", "coach", "stadium", "cricket", "baseball", "football", "soccer", "basketball", "tennis", "golf", "hockey", "rugby", "boxing", "racing", "swimming", "cycling", "olympics", "fitness", "workout", "exercise", "run", "race", "ball", "bat", "wicket", "bowl", "pitch", "field", "court", "track"]
    },
    "IAB18": {
      "name": "Style & Fashion",
      "subcategories": {"IAB18-1": "Beauty", "IAB18-2": "Body Art", "IAB18-3": "Fashion"},
      "keywords": ["fashion", "style", "clothing", "dress", "beauty", "accessory", "jewelry", "cosmetic", "makeup", "hair", "model", "designer"]
    },
    "IAB19": {
      "name": "Technology & Computing",
      "subcategories": {"IAB19-1": "3-D Graphics", "IAB19-2": "Animation", "IAB19-3": "Antivirus Software"},
      "keywords": ["technology", "computer", "software", "hardware", "internet", "digital", "app", "programming", "code", "device", "gadget", "electronics", "mobile", "phone", "laptop", "tablet"]
    },
    "IAB20": {
      "name": "Travel",
      "subcategories": {"IAB20-1": "Adventure Travel", "IAB20-2": "Africa", "IAB20-3": "Air Travel"},
      "keywords": ["travel", "vacation", "tourism", "tourist", "destination", "hotel", "resort", "flight", "airline", "cruise", "beach", "mountain", "trip", "journey", "tour"]
    },
    "IAB21": {
      "name": "Real Estate",
      "subcategories": {"IAB21-1": "Apartments", "IAB21-2": "Architects", "IAB21-3": "Buying/Selling Homes"},
      "keywords": ["real estate", "property", "home", "house", "apartment", "condo", "rent", "buy", "sell", "mortgage", "realtor", "broker", "listing"]
    },
    "IAB22": {
      "name": "Shopping",
      "subcategories": {"IAB22-1": "Contests & Freebies", "IAB22-2": "Couponing", "IAB22-3": "Comparison"},
      "keywords": ["shopping", "store", "retail", "mall", "shop", "buy", "purchase", "product", "price", "discount", "sale", "deal", "coupon"]
    },
    "IAB23": {
      "name": "Religion & Spirituality",
      "subcategories": {"IAB23-1": "Alternative Religions", "IAB23-2": "Atheism/Agnosticism", "IAB23-3": "Buddhism"},
      "keywords": ["religion", "spiritual", "faith", "god", "church", "prayer", "worship", "belief", "religious", "christian", "muslim", "islam", "hindu", "buddhist", "jewish"]
    }
  };

  /**
   * Maps text content to relevant IAB categories using keyword matching
   * @param {string} text - The text to analyze for IAB category mapping
   * @returns {Array} - Array of matching IAB categories
   */
  function mapToIABCategories(text) {
    // Convert input text to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();

    // Store matches with their scores
    const categoryMatches = {};

    // Iterate through each IAB category
    for (const [categoryCode, category] of Object.entries(IAB_CATEGORIES)) {
      let score = 0;

      // Check for keyword matches in the main category
      for (const keyword of category.keywords) {
        // Use regular expression to find whole word matches
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerText.match(regex);

        if (matches) {
          // Add to the score based on the number of matches
          score += matches.length;
        }
      }

      // If we have matches, store the category with its score
      if (score > 0) {
        categoryMatches[categoryCode] = {
          code: categoryCode,
          name: category.name,
          score: score,
          subcategories: []
        };

        // Check for subcategory matches
        for (const [subCode, subName] of Object.entries(category.subcategories)) {
          // Convert subcategory name to keywords
          const subKeywords = subName.toLowerCase().split(/\s+/);
          let subScore = 0;

          for (const keyword of subKeywords) {
            if (keyword.length < 3) continue; // Skip short words

            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = lowerText.match(regex);

            if (matches) {
              subScore += matches.length;
            }
          }

          // Special case for Cricket
          if (subCode === "IAB17-9" && /\bcricket\b/i.test(lowerText)) {
            subScore += 10; // Give a high score for direct cricket mentions
          }

          if (subScore > 0) {
            categoryMatches[categoryCode].subcategories.push({
              code: subCode,
              name: subName,
              score: subScore
            });
          }
        }
      }
    }

    // Convert to array and sort by score (highest first)
    const sortedCategories = Object.values(categoryMatches)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Get top 3 categories

    // Format the results
    const result = [];
    for (const category of sortedCategories) {
      // Sort subcategories by score
      category.subcategories.sort((a, b) => b.score - a.score);

      if (category.subcategories.length > 0) {
        // Add the top subcategory
        const topSubcategory = category.subcategories[0];
        result.push({
          code: `${category.code}:${topSubcategory.code}`,
          name: `${category.name} → ${topSubcategory.name}`,
          mainCategory: {
            code: category.code,
            name: category.name
          },
          subCategory: {
            code: topSubcategory.code,
            name: topSubcategory.name
          }
        });
      } else {
        // Just add the main category
        result.push({
          code: category.code,
          name: category.name,
          mainCategory: {
            code: category.code,
            name: category.name
          },
          subCategory: null
        });
      }
    }

    return result;
  }
