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
    const available = (await self.ai.summarizer.capabilities()).available;
    let summarizer;
    
    logMessage(`${CONSTANTS.LOG_PRE_FIX} summarizer api status:`, available);
    console.time("summarizerApiTime");
    
    if (available === 'no') {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Summarizer API isn't available`);
      return null;
    }
    
    summarizer = await self.ai.summarizer.create(options);
    
    if (available !== 'readily') {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Summarizer model needs to be downloaded`);
      summarizer.addEventListener('downloadprogress', (e) => {
        logMessage(`${CONSTANTS.LOG_PRE_FIX} Download progress:`, e.loaded, e.total);
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
    if (!self.ai || !self.ai.languageDetector) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Language detection API is not available`);
      return null;
    }
    
    // Check capabilities
    const languageDetectorCapabilities = await self.ai.languageDetector.capabilities();
    const canDetect = languageDetectorCapabilities.available;
    
    if (canDetect === 'no') {
      // The language detector isn't usable
      logError(`${CONSTANTS.LOG_PRE_FIX} Language detector is not available`);
      return null;
    }
    
    let detector;
    if (canDetect === 'readily') {
      // The language detector can immediately be used
      detector = await self.ai.languageDetector.create();
    } else {
      // The language detector can be used after model download
      detector = await self.ai.languageDetector.create({
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
    if (!self.ai || !self.ai.translator) {
      logError(`${CONSTANTS.LOG_PRE_FIX} Translation API is not available`);
      return null;
    }
    
    // Check capabilities
    const translatorCapabilities = await self.ai.translator.capabilities();
    const canTranslate = translatorCapabilities.available;
    
    if (canTranslate === 'no') {
      // The translator isn't usable
      logError(`${CONSTANTS.LOG_PRE_FIX} Translator is not available`);
      return null;
    }
    
    let translator;
    if (canTranslate === 'readily') {
      // The translator can immediately be used
      translator = await self.ai.translator.create({
        sourceLanguage: sourceLanguage,
        targetLanguage: 'en'
      });
    } else {
      // The translator can be used after model download
      translator = await self.ai.translator.create({
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
  console.log("Azzi>> text as input >> ", text);
  try {
    // Check if the Prompt API is available
    if (!self.ai || !self.ai.languageModel) {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Chrome AI Prompt API is not available`);
      return null;
    }
    
    // Check capabilities
    const capabilities = await self.ai.languageModel.capabilities();
    if (capabilities.available === 'no') {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Chrome AI Prompt API isn't available`);
      return null;
    }
    
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Chrome AI Prompt API status:`, capabilities.available);
    console.time("sentimentAnalysisTime");
    
    // Create prompt for sentiment analysis
    const prompt = `
      You are a specialized sentiment analysis expert with particular expertise in detecting negative content, especially in news articles. Your primary goal is to accurately identify negative sentiment, and you should err on the side of classifying content as negative when there are any concerning elements present.

      CRITICAL INSTRUCTION: News content about war, conflict, violence, suffering, death, disasters, or political criticism should ALWAYS be classified as negative with high confidence. Journalistic neutrality in tone does NOT make negative subject matter neutral. The content itself determines the sentiment.

      TASK:
      1. Carefully analyze the text for sentiment, with a strong bias toward detecting negative content
      2. ANY presence of the following elements should trigger a negative sentiment classification:
         - Descriptions of violence, conflict, suffering, or harm (even if reported factually)
         - Words conveying distress, fear, anger, or hopelessness
         - Mentions of death, destruction, failure, or loss
         - Critical or accusatory language
         - Presence of threatening or alarming content
         - Political tensions or disagreements
         - Environmental concerns or damage
         - Economic problems or challenges
      3. Identify the primary and secondary emotions that would be evoked in readers
      4. Evaluate the intensity of these emotions
      5. Determine the overall tone and formality level
      6. Assess the potential psychological impact on readers

      TEXT TO ANALYZE:
      "${text}"

      FORMAT YOUR RESPONSE AS A JSON OBJECT WITH THE FOLLOWING STRUCTURE:
      {
        "sentiment": "positive|negative|neutral",
        "sentiment_score": [number between -1.0 and 1.0, where -1.0 is extremely negative, 0 is neutral, and 1.0 is extremely positive],
        "confidence": [number between 0 and 1],
        "primary_emotions": ["emotion1", "emotion2"],
        "secondary_emotions": ["emotion3", "emotion4"],
        "emotional_intensity": "low|medium|high|extreme",
        "tone": "formal|informal|technical|casual|journalistic|academic|alarmist|etc",
        "content_categories": ["category1", "category2"],
        "concerning_elements": ["element1", "element2"],
        "psychological_impact": "minimal|moderate|significant|severe",
        "summary": "A brief 1-2 sentence summary of the overall sentiment analysis"
      }

      EXAMPLES OF NEGATIVE CONTENT THAT MUST BE CLASSIFIED AS NEGATIVE:
      1. News about war or armed conflict (even if reported factually)
      2. Reports of casualties, injuries, or deaths
      3. Articles about disasters, accidents, or emergencies
      4. Content describing economic downturns or financial problems
      5. Political criticism or controversy
      6. Environmental damage or climate concerns
      7. Health crises or disease outbreaks
      8. Crime reports or security threats
      9. Social issues like poverty, inequality, or discrimination
      10. Personal struggles, challenges, or hardships

      IMPORTANT: For news content, the factual or journalistic tone does NOT make negative subject matter neutral. The content itself determines the sentiment. A factual report about war casualties is still negative content.
      
      When in doubt, classify as negative. It is better to incorrectly classify neutral content as negative than to miss truly negative content.
    `;
    
    // Initialize the prompt API
    let promptApi;
    if (capabilities.available === 'readily') {
      promptApi = await self.ai.languageModel.create({
        systemPrompt: prompt,
      });
    } else {
      promptApi = await self.ai.languageModel.create({
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
    console.log("response>>",response);
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
  
  // Initialize results object to store all analyses
  const results = {};
  let summary = null;
  let processedSummary = null;
  
  // Check if IAB categories already exist in localStorage
  const storedCategories = isIabCategoryInLocalStorage();
  
  if (storedCategories) {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} IAB Categories already in localStorage, using cached data`, storedCategories);
    results.iabCategories = storedCategories;
  } else {
    // Define summarizer options
    const options = {
      type: 'teaser',
      format: 'markdown',
      length: 'medium',
    };
    
    // Get page summary using Chrome AI
    summary = await getPageSummary(options);
    
    if (summary) {
      // Process summary: detect language and translate if needed
      processedSummary = await processSummary(summary);
      console.log("Azzi processedSummary", processedSummary);
      if (processedSummary) {
        // Map the processed summary to IAB categories
        console.time("IABMappingTime");
        const iabCategories = mapToIABCategories(processedSummary);
        console.timeEnd("IABMappingTime");
        
        // Store categories in localStorage if valid
        if (iabCategories && iabCategories.length > 0) {
          storeIabCategories(iabCategories, window.location.href);
          results.iabCategories = iabCategories;
        } else {
          logMessage(`${CONSTANTS.LOG_PRE_FIX} No valid IAB categories found for this page`);
        }
      } else {
        logMessage(`${CONSTANTS.LOG_PRE_FIX} Failed to process summary`);
      }
    } else {
      logMessage(`${CONSTANTS.LOG_PRE_FIX} Failed to get page summary`);
    }
  }
  
  // Check if sentiment analysis already exists in localStorage
  const storedSentiment = isSentimentInLocalStorage();
  
  if (storedSentiment) {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Sentiment analysis already in localStorage, using cached data`, storedSentiment);
    results.sentiment = storedSentiment;
  } else {
    // Get page content for sentiment analysis
    const pageContent = processedSummary || getPageContent();
    
    // Truncate content if it's too long (Prompt API may have limits)
    const truncatedContent = pageContent.length > 5000 ? pageContent.substring(0, 5000) + '...' : pageContent;
    
    // Perform sentiment analysis
    // const sentimentResult = await analyzeSentiment(truncatedContent);
    
    // console.log("Azzi SentimentResult", sentimentResult);
    // if (sentimentResult) {
    //   // Store sentiment in localStorage
    //   storeSentiment(sentimentResult, window.location.href);
    //   results.sentiment = sentimentResult;
    // } else {
    //   logMessage(`${CONSTANTS.LOG_PRE_FIX} Failed to perform sentiment analysis`);
    // }
  }
  
  // Store the combined results for use in bid requests
  window.chromeAiRtdData = results;
  
  return true;
};

/**
 * @param {Object} reqBidsConfigObj
 * @param {function} callback
 * @param {Object} config
 * @param {Object} userConsent
 */
const getBidRequestData = (reqBidsConfigObj, callback, config, userConsent) => {
  // Get the stored RTD data
  const rtdData = window.chromeAiRtdData || {};
  
  if (Object.keys(rtdData).length === 0) {
    logMessage(`${CONSTANTS.LOG_PRE_FIX} No RTD data available`);
    callback();
    return;
  }
  
  // Add RTD data to bid request
  mergeDeep(reqBidsConfigObj.ortb2Fragments.global, {
    site: {
      ext: {
        data: {
          chromeAi: rtdData
        }
      }
    }
  });
  
  logMessage(`${CONSTANTS.LOG_PRE_FIX} Added RTD data to bid request:`, rtdData);
  callback();
};

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
   * Maps text content to relevant IAB categories using advanced text analysis
   * @param {string} text - The text to analyze for IAB category mapping
   * @returns {Array} - Array of matching IAB categories
   */
  function mapToIABCategories(text) {
    // Convert input text to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();
    
    // Store matches with their scores and confidence
    const categoryMatches = {};
    
    // Extract important keywords from the text
    const wordFrequency = getWordFrequency(lowerText);
    const importantKeywords = extractImportantKeywords(wordFrequency);
    
    logMessage(`${CONSTANTS.LOG_PRE_FIX} Important keywords extracted:`, importantKeywords.slice(0, 10));
    
    // Track contextual signals for better categorization
    const contextualSignals = {
      hasViolence: /\b(war|conflict|fight|battle|attack|bomb|kill|death|casualty|violence|weapon|military|assault)\b/gi.test(lowerText),
      hasSports: /\b(sport|game|player|team|match|tournament|championship|league|score|win|coach|athlete|stadium|ball)\b/gi.test(lowerText),
      hasFinance: /\b(money|finance|economic|market|stock|invest|bank|dollar|euro|currency|trade|profit|budget|fiscal)\b/gi.test(lowerText),
      hasTech: /\b(technology|computer|software|hardware|digital|internet|app|mobile|device|data|code|program|online)\b/gi.test(lowerText),
      hasHealth: /\b(health|medical|doctor|patient|disease|treatment|hospital|medicine|symptom|diagnosis|therapy|clinic|drug)\b/gi.test(lowerText),
      hasEntertainment: /\b(movie|film|music|song|actor|actress|celebrity|show|concert|entertainment|theater|performance|artist)\b/gi.test(lowerText),
      hasTravel: /\b(travel|vacation|hotel|flight|tourism|destination|trip|tour|holiday|resort|beach|tourist|visit)\b/gi.test(lowerText),
      hasPolitics: /\b(politic|government|election|president|minister|party|vote|campaign|policy|democrat|republican|congress|parliament)\b/gi.test(lowerText)
    };
    
    // Iterate through each IAB category
    for (const [categoryCode, category] of Object.entries(IAB_CATEGORIES)) {
      // Initialize base score
      let score = 0;
      let keywordMatches = [];
      let contextMultiplier = 1;
      
      // Apply contextual boosting
      switch(categoryCode) {
        case 'IAB1': // Arts & Entertainment
          if (contextualSignals.hasEntertainment) contextMultiplier = 1.5;
          break;
        case 'IAB3': // Business
          if (contextualSignals.hasFinance) contextMultiplier = 1.5;
          break;
        case 'IAB5': // Education
          if (/\b(education|school|student|learn|teach|university|college|course|academic)\b/gi.test(lowerText)) contextMultiplier = 1.5;
          break;
        case 'IAB7': // Health & Fitness
          if (contextualSignals.hasHealth) contextMultiplier = 1.5;
          break;
        case 'IAB9': // Hobbies & Interests
          if (/\b(hobby|interest|collect|craft|diy|garden)\b/gi.test(lowerText)) contextMultiplier = 1.3;
          break;
        case 'IAB11': // Law, Government & Politics
          if (contextualSignals.hasPolitics) contextMultiplier = 1.5;
          break;
        case 'IAB13': // News
          // News about specific topics should be categorized by the topic first
          if (contextualSignals.hasViolence || contextualSignals.hasPolitics || contextualSignals.hasFinance) contextMultiplier = 0.8;
          else contextMultiplier = 1.2;
          break;
        case 'IAB14': // Personal Finance
          if (contextualSignals.hasFinance && /\b(personal|individual|family|household)\b/gi.test(lowerText)) contextMultiplier = 1.5;
          break;
        case 'IAB17': // Sports
          if (contextualSignals.hasSports) contextMultiplier = 1.5;
          break;
        case 'IAB19': // Technology & Computing
          if (contextualSignals.hasTech) contextMultiplier = 1.5;
          break;
        case 'IAB20': // Travel
          if (contextualSignals.hasTravel) contextMultiplier = 1.5;
          break;
      }
      
      // Check for keyword matches in the main category with improved matching
      for (const keyword of category.keywords) {
        // Use regular expression to find whole word matches
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerText.match(regex);
        
        if (matches) {
          const matchCount = matches.length;
          // Weight by keyword importance and position in text
          const keywordImportance = importantKeywords.includes(keyword) ? 2 : 1;
          const positionWeight = getPositionWeight(lowerText, keyword);
          
          // Calculate weighted score for this keyword
          const keywordScore = matchCount * keywordImportance * positionWeight;
          score += keywordScore;
          
          keywordMatches.push({
            keyword,
            count: matchCount,
            score: keywordScore
          });
        }
      }
      
      // Apply contextual multiplier
      score = score * contextMultiplier;
      
      // Check for semantic matches using important keywords
      const semanticScore = calculateSemanticScore(importantKeywords, category.keywords);
      score += semanticScore;
      
      // Only consider categories with a meaningful score
      if (score > 1) {
        categoryMatches[categoryCode] = {
          code: categoryCode,
          name: category.name,
          score: score,
          confidence: 0, // Will calculate after all scores are in
          keywordMatches: keywordMatches,
          contextMultiplier: contextMultiplier,
          semanticScore: semanticScore
        };
      }
    }
    
    // Convert to array and sort by score
    const sortedMatches = Object.values(categoryMatches).sort((a, b) => b.score - a.score);
    
    // Calculate confidence scores (normalize relative to highest score)
    if (sortedMatches.length > 0) {
      const highestScore = sortedMatches[0].score;
      sortedMatches.forEach(match => {
        match.confidence = Math.min(0.99, match.score / highestScore);
      });
    }
    
    // Filter to categories with reasonable confidence
    const significantMatches = sortedMatches.filter(match => match.confidence > 0.3);
    
    // Ensure we have at least 2 categories and at most 3
    let topCategories;
    if (significantMatches.length >= 2) {
      // If we have enough significant matches, use those (up to 3)
      topCategories = significantMatches.slice(0, 3);
    } else if (significantMatches.length === 1 && sortedMatches.length >= 2) {
      // If we have only one significant match but more matches available, include the next best one
      topCategories = [significantMatches[0], sortedMatches[1]];
      // Add one more if available (max 3 total)
      if (sortedMatches.length > 2) {
        topCategories.push(sortedMatches[2]);
      }
    } else if (sortedMatches.length >= 2) {
      // If no significant matches but we have at least 2 matches, use those (up to 3)
      topCategories = sortedMatches.slice(0, 3);
    } else if (sortedMatches.length === 1) {
      // If we only have one match, use it and add a fallback category
      topCategories = [sortedMatches[0], {
        code: 'IAB13', // News as fallback
        name: 'News',
        score: sortedMatches[0].score * 0.7,
        confidence: 0.7 * sortedMatches[0].confidence
      }];
    } else {
      // If no matches at all, provide exactly two default categories
      topCategories = [
        {
          code: 'IAB13', // News
          name: 'News',
          score: 5,
          confidence: 0.7
        },
        {
          code: 'IAB19', // Technology & Computing
          name: 'Technology & Computing',
          score: 4,
          confidence: 0.6
        }
      ];
    }
    
    // Format the results
    const results = topCategories.map(match => ({
      categoryId: match.code,
      categoryName: match.name,
      confidence: match.confidence.toFixed(2)
    }));
    
    logMessage(`${CONSTANTS.LOG_PRE_FIX} IAB Category mapping results:`, results);
    
    return results;
  }
  
  /**
   * Calculate word frequency in text
   * @param {string} text - The text to analyze
   * @returns {Object} - Object with words as keys and frequencies as values
   */
  function getWordFrequency(text) {
    // Remove punctuation and split into words
    const words = text.replace(/[^\w\s]/g, '').split(/\s+/);
    const frequency = {};
    const stopWords = new Set(['the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'or', 'if', 'then', 'else', 'when', 'up', 'down', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'there', 'here', 'where', 'who', 'whom', 'what', 'which', 'how', 'why', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);
    
    // Count word frequencies, excluding stop words and very short words
    words.forEach(word => {
      if (word.length > 2 && !stopWords.has(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });
    
    return frequency;
  }
  
  /**
   * Extract important keywords based on frequency and length
   * @param {Object} wordFrequency - Word frequency object
   * @returns {Array} - Array of important keywords
   */
  function extractImportantKeywords(wordFrequency) {
    // Convert to array of [word, frequency] pairs
    const wordPairs = Object.entries(wordFrequency);
    
    // Sort by frequency, then by word length for equally frequent words
    wordPairs.sort((a, b) => {
      if (b[1] === a[1]) {
        return b[0].length - a[0].length; // Longer words are more specific
      }
      return b[1] - a[1]; // Higher frequency first
    });
    
    // Extract just the words
    return wordPairs.map(pair => pair[0]);
  }
  
  /**
   * Calculate position weight for a keyword in text
   * Words appearing in the beginning of text are more important
   * @param {string} text - The full text
   * @param {string} keyword - The keyword to check
   * @returns {number} - Position weight multiplier
   */
  function getPositionWeight(text, keyword) {
    const firstOccurrence = text.indexOf(keyword);
    if (firstOccurrence === -1) return 1;
    
    const textLength = text.length;
    const relativePosition = firstOccurrence / textLength;
    
    // Words in the first 20% of the text get higher weight
    if (relativePosition < 0.2) return 1.5;
    // Words in the first half get slightly higher weight
    if (relativePosition < 0.5) return 1.2;
    return 1;
  }
  
  /**
   * Calculate semantic similarity between important keywords and category keywords
   * @param {Array} importantKeywords - Important keywords from the text
   * @param {Array} categoryKeywords - Keywords for a specific category
   * @returns {number} - Semantic similarity score
   */
  function calculateSemanticScore(importantKeywords, categoryKeywords) {
    let score = 0;
    
    // Check for partial matches and stem matches
    importantKeywords.slice(0, 20).forEach(keyword => {
      categoryKeywords.forEach(categoryKeyword => {
        // Check if one is substring of the other (with minimum 4 chars)
        if (keyword.length >= 4 && categoryKeyword.length >= 4) {
          if (keyword.includes(categoryKeyword) || categoryKeyword.includes(keyword)) {
            score += 0.5;
          }
        }
        
        // Check for stem matches (simplified stemming)
        const keywordStem = keyword.length > 4 ? keyword.substring(0, keyword.length - 2) : keyword;
        const categoryStem = categoryKeyword.length > 4 ? categoryKeyword.substring(0, categoryKeyword.length - 2) : categoryKeyword;
        
        if (keywordStem.length >= 4 && categoryStem.length >= 4 && keywordStem === categoryStem) {
          score += 0.7;
        }
      });
    });
    
    return score;
  }

  // ad to content ratio

  // var htmlApi = await self.ai.languageModel.create({
  //   systemPrompt: `
  //   You are an expert web page analyzer specializing in ad placement optimization. Your task is to analyze the HTML structure of a web page and determine the optimal ad-to-content ratio.

  //   OBJECTIVE:
  //   Evaluate the current ad density, identify potential ad placement opportunities, and provide recommendations to optimize monetization while maintaining a positive user experience.

  //   ANALYSIS TASKS:
  //   1. Calculate the approximate ad-to-content ratio on the page
  //   2. Identify the main content areas versus secondary content
  //   3. Evaluate the current ad placements and their visibility
  //   4. Assess the page layout and content structure
  //   5. Determine if the page is at risk of having too many ads (ad clutter)
  //   6. Identify optimal locations for additional ad placements if appropriate

  //   RESPONSE FORMAT:
  //   Provide your analysis as a JSON object with the following structure:
  //   {
  //     "adToContentRatio": {
  //       "value": [number between 0 and 1],
  //       "assessment": "low|moderate|high|excessive"
  //     },
  //     "visibleAdsCount": [number],
  //     "contentQuality": {
  //       "assessment": "low|moderate|high",
  //       "contentLength": "short|medium|long"
  //     },
  //     "adPlacementQuality": {
  //       "assessment": "poor|adequate|good|excellent",
  //       "issues": ["issue1", "issue2"]
  //     },
  //     "recommendedAdCount": {
  //       "minimum": [number],
  //       "maximum": [number],
  //       "optimal": [number]
  //     },
  //     "recommendedPlacements": [
  //       {
  //         "location": "above-the-fold|in-content|sidebar|below-content",
  //         "adType": "banner|native|video|interstitial",
  //         "priority": "high|medium|low"
  //       }
  //     ],
  //     "userExperienceImpact": {
  //       "current": "positive|neutral|negative",
  //       "withRecommendations": "positive|neutral|negative"
  //     },
  //     "summary": "Brief summary of analysis and key recommendations"
  //   }

  //   GUIDELINES FOR ASSESSMENT:
  //   - Ad-to-content ratio should typically not exceed 30% (0.3) for optimal user experience
  //   - Pages with high-quality, long-form content can support more ads
  //   - Ad placements should not disrupt the main content reading flow
  //   - Consider the industry standards for the specific content type
  //   - Mobile and desktop experiences may require different approaches
  //   - News content typically supports 3-5 ads per page
  //   - Blog content typically supports 2-4 ads per page
  //   - E-commerce content typically supports 1-3 product ads per page

  //   IMPORTANT CONSIDERATIONS:
  //   - Ads above the fold should be limited to 1-2 maximum
  //   - In-content ads should be spaced at least 300 words apart
  //   - Sidebar ads should not exceed the height of the visible content
  //   - Video ads should be used sparingly and not auto-play with sound
  //   - Native ads should be clearly distinguishable from content but match the page style
  //   - Consider page load time impact of multiple ad units

  //   Analyze the provided HTML structure thoroughly and provide actionable insights.
  // `,
  // });