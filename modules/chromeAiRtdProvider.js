import { submodule } from '../src/hook.js';
import { logError, mergeDeep } from '../src/utils.js';
/**
 * @typedef {import('../modules/rtdModule/index.js').RtdSubmodule} RtdSubmodule
 */

const CONSTANTS = Object.freeze({
  SUBMODULE_NAME: 'chromeAi',
  REAL_TIME_MODULE: 'realTimeData',
  LOG_PRE_FIX: 'ChromeAI-Rtd-Provider: ',
  STORAGE_KEY: 'chromeAi_iabCategories'
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
      console.error(`${CONSTANTS.LOG_PRE_FIX} Error parsing localStorage:`, e);
    }
  }
  
  return null;
};

/**
 * Initialize the ChromeAI RTD Module.
 * @param {Object} config
 * @param {Object} _userConsent
 * @returns {boolean}
 */
const init = async (config, _userConsent) => {
    console.log("ChromeAi : config", config);
    //console.log("ChromeAi : _userConsent", _userConsent);
    const options = {
        type: 'teaser',
        format: 'markdown',
        length: 'short',
      };
      
      // Check if IAB categories already exist in localStorage
      const storedCategories = isIabCategoryInLocalStorage();
      let iabCategories;
      
      if (!storedCategories) {
        const available = (await self.ai.summarizer.capabilities()).available;
        let summarizer;
        console.log("summarizer api status:",available);
        console.time("summarizerApiTime");
        if (available === 'no') {
            // The Summarizer API isn't usable.
            return;
        }
        if (available === 'readily') {
            // The Summarizer API can be used immediately .
            summarizer = await self.ai.summarizer.create(options);
        } else {
            // The Summarizer API can be used after the model is downloaded.
            summarizer = await self.ai.summarizer.create(options);
            console.log("Azzi123 >> summarizer >> ", summarizer);
            summarizer.addEventListener('downloadprogress', (e) => {
            console.log(e.loaded, e.total);
            });
            await summarizer.ready;
        }
        const longText = document.querySelector('body').innerHTML;
        const summary = await summarizer.summarize(longText, {
            context: 'This article is intended for a sports audience.',
        });
        console.timeEnd("summarizerApiTime");
        console.log("Summary >> ", summary);
        
        console.time("IABMappingTime");
        // Get the existing categories object or create a new one
        let categoriesObject = {};
        const storedCategoriesJson = localStorage.getItem(CONSTANTS.STORAGE_KEY);
        if (storedCategoriesJson) {
          categoriesObject = JSON.parse(storedCategoriesJson);
        }
        
        // Map the summary to IAB categories if not in localStorage
        iabCategories = mapToIABCategories(summary);
        console.timeEnd("IABMappingTime");
        
        // Only store in localStorage if we have valid IAB categories
        if (iabCategories && iabCategories.length > 0) {
          // Store the result in the categories object
          categoriesObject[window.location.href] = iabCategories;
          // Save the updated object back to localStorage
          localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(categoriesObject));
          console.log("IAB Categories from mapping:", iabCategories);
        } else {
          console.log("No valid IAB categories found for this page");
        }
      } else {
        console.log("IAB Categories already in localStorage, skipping mapping", storedCategories);
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
    console.log("ChromeAi : reqBidsConfigObj", reqBidsConfigObj);
    
    // Check if IAB categories exist in localStorage
    const storedCategories = isIabCategoryInLocalStorage();
    if (storedCategories) {
      console.log("Setting  IAB Categories from localStorage:", storedCategories);
      mergeDeep(reqBidsConfigObj.ortb2Fragments.bidder, {
                    'pubmatic': {
                        site:{
                            ext: storedCategories
                        }
                    }
                });
    } else {
      console.log("No IAB Categories found in localStorage for current URL");
    }
    console.log("after changing ",reqBidsConfigObj);
    
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
      "subcategories": {
        "IAB1-1": "Books & Literature",
        "IAB1-2": "Celebrity Fan/Gossip",
        "IAB1-3": "Fine Art",
        "IAB1-4": "Humor",
        "IAB1-5": "Movies",
        "IAB1-6": "Music",
        "IAB1-7": "Television"
      },
      "keywords": ["entertainment", "art", "movie", "film", "music", "concert", "book", "novel", "celebrity", "actor", "actress", "director", "tv", "television", "show", "theater", "comedy", "drama"]
    },
    "IAB2": {
      "name": "Automotive",
      "subcategories": {
        "IAB2-1": "Auto Parts",
        "IAB2-2": "Auto Repair",
        "IAB2-3": "Buying/Selling Cars"
      },
      "keywords": ["car", "vehicle", "automotive", "auto", "truck", "suv", "repair", "parts", "dealer", "driving"]
    },
    "IAB3": {
      "name": "Business",
      "subcategories": {
        "IAB3-1": "Advertising",
        "IAB3-2": "Agriculture",
        "IAB3-3": "Biotech/Biomedical"
      },
      "keywords": ["business", "company", "corporate", "industry", "market", "finance", "investment", "economy", "trade", "stock", "management"]
    },
    "IAB4": {
      "name": "Careers",
      "subcategories": {
        "IAB4-1": "Career Planning",
        "IAB4-2": "College",
        "IAB4-3": "Financial Aid"
      },
      "keywords": ["job", "career", "employment", "hiring", "resume", "interview", "salary", "profession", "work"]
    },
    "IAB5": {
      "name": "Education",
      "subcategories": {
        "IAB5-1": "7-12 Education",
        "IAB5-2": "Adult Education",
        "IAB5-3": "Art History"
      },
      "keywords": ["education", "school", "university", "college", "degree", "academic", "learning", "student", "teacher", "professor", "course", "class"]
    },
    "IAB6": {
      "name": "Family & Parenting",
      "subcategories": {
        "IAB6-1": "Adoption",
        "IAB6-2": "Babies & Toddlers",
        "IAB6-3": "Daycare/Pre School"
      },
      "keywords": ["family", "parent", "child", "baby", "kid", "mother", "father", "pregnancy", "toddler", "parenting"]
    },
    "IAB7": {
      "name": "Health & Fitness",
      "subcategories": {
        "IAB7-1": "Exercise",
        "IAB7-2": "A.D.D.",
        "IAB7-3": "AIDS/HIV"
      },
      "keywords": ["health", "fitness", "exercise", "workout", "diet", "nutrition", "medical", "disease", "doctor", "hospital", "medicine", "wellness"]
    },
    "IAB8": {
      "name": "Food & Drink",
      "subcategories": {
        "IAB8-1": "American Cuisine",
        "IAB8-2": "Barbecues & Grilling",
        "IAB8-3": "Cajun/Creole"
      },
      "keywords": ["food", "drink", "recipe", "cooking", "cuisine", "restaurant", "chef", "meal", "dinner", "lunch", "breakfast", "baking", "grill"]
    },
    "IAB9": {
      "name": "Hobbies & Interests",
      "subcategories": {
        "IAB9-1": "Art/Technology",
        "IAB9-2": "Arts & Crafts",
        "IAB9-3": "Beadwork"
      },
      "keywords": ["hobby", "craft", "collection", "diy", "gardening", "photography", "sewing", "knitting", "woodworking", "interest"]
    },
    "IAB10": {
      "name": "Home & Garden",
      "subcategories": {
        "IAB10-1": "Appliances",
        "IAB10-2": "Entertaining",
        "IAB10-3": "Environmental Safety"
      },
      "keywords": ["home", "house", "garden", "furniture", "decor", "interior", "design", "decoration", "gardening", "landscaping", "lawn", "appliance"]
    },
    "IAB11": {
      "name": "Law, Gov't & Politics",
      "subcategories": {
        "IAB11-1": "Immigration",
        "IAB11-2": "Legal Issues",
        "IAB11-3": "Government"
      },
      "keywords": ["law", "legal", "government", "politics", "policy", "election", "vote", "political", "president", "congress", "court", "legislation"]
    },
    "IAB12": {
      "name": "News",
      "subcategories": {
        "IAB12-1": "International News",
        "IAB12-2": "National News",
        "IAB12-3": "Local News"
      },
      "keywords": ["news", "headline", "report", "journalist", "media", "press", "breaking", "current events", "update"]
    },
    "IAB13": {
      "name": "Personal Finance",
      "subcategories": {
        "IAB13-1": "Beginning Investing",
        "IAB13-2": "Credit/Debt & Loans",
        "IAB13-3": "Financial News"
      },
      "keywords": ["finance", "money", "invest", "loan", "credit", "debt", "mortgage", "banking", "budget", "saving", "retirement"]
    },
    "IAB14": {
      "name": "Society",
      "subcategories": {
        "IAB14-1": "Dating",
        "IAB14-2": "Divorce Support",
        "IAB14-3": "Gay Life"
      },
      "keywords": ["society", "culture", "community", "relationship", "dating", "wedding", "marriage", "divorce", "social"]
    },
    "IAB15": {
      "name": "Science",
      "subcategories": {
        "IAB15-1": "Astrology",
        "IAB15-2": "Biology",
        "IAB15-3": "Chemistry"
      },
      "keywords": ["science", "research", "scientific", "biology", "chemistry", "physics", "astronomy", "technology", "experiment", "discovery"]
    },
    "IAB16": {
      "name": "Pets",
      "subcategories": {
        "IAB16-1": "Aquariums",
        "IAB16-2": "Birds",
        "IAB16-3": "Cats"
      },
      "keywords": ["pet", "dog", "cat", "animal", "veterinarian", "breed", "fish", "bird", "reptile", "hamster"]
    },
    "IAB17": {
      "name": "Sports",
      "subcategories": {
        "IAB17-1": "Auto Racing",
        "IAB17-2": "Baseball",
        "IAB17-3": "Bicycling",
        "IAB17-4": "Bodybuilding",
        "IAB17-5": "Boxing",
        "IAB17-6": "Canoeing/Kayaking",
        "IAB17-7": "Cheerleading",
        "IAB17-8": "Climbing",
        "IAB17-9": "Cricket",
        "IAB17-10": "Figure Skating",
        "IAB17-11": "Fly Fishing",
        "IAB17-12": "Football",
        "IAB17-13": "Freshwater Fishing",
        "IAB17-14": "Game & Fish",
        "IAB17-15": "Golf",
        "IAB17-16": "Horse Racing",
        "IAB17-17": "Horses",
        "IAB17-18": "Hunting/Shooting",
        "IAB17-19": "Inline Skating",
        "IAB17-20": "Martial Arts",
        "IAB17-21": "Mountain Biking",
        "IAB17-22": "NASCAR Racing",
        "IAB17-23": "Olympics",
        "IAB17-24": "Paintball",
        "IAB17-25": "Power & Motorcycles",
        "IAB17-26": "Pro Basketball",
        "IAB17-27": "Pro Ice Hockey",
        "IAB17-28": "Rodeo",
        "IAB17-29": "Rugby",
        "IAB17-30": "Running/Jogging",
        "IAB17-31": "Sailing",
        "IAB17-32": "Saltwater Fishing",
        "IAB17-33": "Scuba Diving",
        "IAB17-34": "Skateboarding",
        "IAB17-35": "Skiing",
        "IAB17-36": "Snowboarding",
        "IAB17-37": "Surfing/Bodyboarding",
        "IAB17-38": "Swimming",
        "IAB17-39": "Table Tennis/Ping-Pong",
        "IAB17-40": "Tennis",
        "IAB17-41": "Volleyball",
        "IAB17-42": "Walking",
        "IAB17-43": "Waterski/Wakeboard",
        "IAB17-44": "World Soccer"
      },
      "keywords": ["sport", "game", "team", "player", "athlete", "championship", "tournament", "match", "competition", "league", "score", "win", "coach", "stadium", "cricket", "baseball", "football", "soccer", "basketball", "tennis", "golf", "hockey", "rugby", "boxing", "racing", "swimming", "cycling", "olympics", "fitness", "workout", "exercise", "run", "race", "ball", "bat", "wicket", "bowl", "pitch", "field", "court", "track"]
    },
    "IAB18": {
      "name": "Style & Fashion",
      "subcategories": {
        "IAB18-1": "Beauty",
        "IAB18-2": "Body Art",
        "IAB18-3": "Fashion"
      },
      "keywords": ["fashion", "style", "clothing", "dress", "beauty", "accessory", "jewelry", "cosmetic", "makeup", "hair", "model", "designer"]
    },
    "IAB19": {
      "name": "Technology & Computing",
      "subcategories": {
        "IAB19-1": "3-D Graphics",
        "IAB19-2": "Animation",
        "IAB19-3": "Antivirus Software"
      },
      "keywords": ["technology", "computer", "software", "hardware", "internet", "digital", "app", "programming", "code", "device", "gadget", "electronics", "mobile", "phone", "laptop", "tablet"]
    },
    "IAB20": {
      "name": "Travel",
      "subcategories": {
        "IAB20-1": "Adventure Travel",
        "IAB20-2": "Africa",
        "IAB20-3": "Air Travel"
      },
      "keywords": ["travel", "vacation", "tourism", "tourist", "destination", "hotel", "resort", "flight", "airline", "cruise", "beach", "mountain", "trip", "journey", "tour"]
    },
    "IAB21": {
      "name": "Real Estate",
      "subcategories": {
        "IAB21-1": "Apartments",
        "IAB21-2": "Architects",
        "IAB21-3": "Buying/Selling Homes"
      },
      "keywords": ["real estate", "property", "home", "house", "apartment", "condo", "rent", "buy", "sell", "mortgage", "realtor", "broker", "listing"]
    },
    "IAB22": {
      "name": "Shopping",
      "subcategories": {
        "IAB22-1": "Contests & Freebies",
        "IAB22-2": "Couponing",
        "IAB22-3": "Comparison"
      },
      "keywords": ["shopping", "store", "retail", "mall", "shop", "buy", "purchase", "product", "price", "discount", "sale", "deal", "coupon"]
    },
    "IAB23": {
      "name": "Religion & Spirituality",
      "subcategories": {
        "IAB23-1": "Alternative Religions",
        "IAB23-2": "Atheism/Agnosticism",
        "IAB23-3": "Buddhism"
      },
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
  