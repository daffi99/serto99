// Arabic Unicode range: U+0600-U+06FF
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g

// Simplified Arabic to Latin transliteration mapping
const SIMPLE_TRANSLITERATION_MAP: { [key: string]: string } = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "aa",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "u",
  ي: "i",
  ى: "a",
  ة: "h",
  ء: "",
  ئ: "",
  ؤ: "",
  "َ": "a",
  "ُ": "u",
  "ِ": "i",
  "ً": "an",
  "ٌ": "un",
  "ٍ": "in",
  "ْ": "",
  "ّ": "",
  "؟": "?",
  "،": ",",
  "؛": ";",
}

// Vowels that don't need implicit vowels after them
const VOWELS = new Set(["ا", "أ", "إ", "آ", "و", "ي", "ى", "ة"])
const DIACRITICS = new Set(["َ", "ُ", "ِ", "ً", "ٌ", "ٍ", "ْ", "ّ"])

// Consonants that typically take "u" before them
const U_BEFORE = new Set(["ن", "م", "ل", "ر"])

// Consonants that typically take "i" before them
const I_BEFORE = new Set(["ر", "ز", "س", "ش", "ت", "ث", "د", "ذ"])

// Consonants at word start that often take "a"
const A_START = new Set(["ا", "ن", "ت", "ب", "ف", "ك", "ل", "م"])

export function extractArabicText(text: string): string[] {
  const matches = text.match(ARABIC_REGEX)
  return matches || []
}

export function transliterateArabic(arabicText: string): string {
  const chars = arabicText.split("")
  let result = ""

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    const nextChar = i < chars.length - 1 ? chars[i + 1] : null
    const prevChar = i > 0 ? chars[i - 1] : null
    const transliterated = SIMPLE_TRANSLITERATION_MAP[char] || char

    // Skip if it's a space or punctuation
    if (char === " " || char === "؟" || char === "،" || char === "؛") {
      result += transliterated
      continue
    }

    // Skip diacritics processing, just add the transliteration
    if (DIACRITICS.has(char)) {
      result += transliterated
      continue
    }

    // Add the transliterated character
    result += transliterated

    // Add implicit vowel between consonants
    if (
      !VOWELS.has(char) && // Current char is not a vowel
      !DIACRITICS.has(char) && // Current char is not a diacritic
      nextChar && // There is a next character
      nextChar !== " " && // Next char is not a space
      !VOWELS.has(nextChar) && // Next char is not a vowel
      !DIACRITICS.has(nextChar) && // Next char is not a diacritic
      transliterated !== "" // Current char produced output
    ) {
      // Choose vowel based on context
      let vowel = "a" // default

      // Use "u" before certain consonants (like ن in هنا -> huna)
      if (U_BEFORE.has(nextChar)) {
        vowel = "u"
      }
      // Use "i" before certain consonants (like ر in انتظري -> antaziri)
      else if (I_BEFORE.has(nextChar)) {
        vowel = "i"
      }
      // Use "a" at word start or with certain patterns
      else if (!prevChar || prevChar === " " || A_START.has(char)) {
        vowel = "a"
      }

      result += vowel
    }
  }

  return result
    .replace(/\s+/g, " ") // Clean up multiple spaces
    .replace(/([aiu])\1+/g, "$1") // Remove duplicate vowels
    .trim()
}

export function replaceArabicInText(originalText: string, replacements: string[]): string {
  let result = originalText
  let replacementIndex = 0

  result = result.replace(ARABIC_REGEX, () => {
    if (replacementIndex < replacements.length) {
      return replacements[replacementIndex++]
    }
    return ""
  })

  return result
}

export async function translateArabicToIndonesian(arabicTexts: string[]): Promise<string[]> {
  // Translation not available - API access issues
  throw new Error("Translation service unavailable due to CORS/network restrictions")
}
