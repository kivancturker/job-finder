/**
 * Performs case-insensitive matching of keywords against a text.
 * Alphanumeric keywords are matched strictly on word boundaries to prevent false positives.
 * Keywords containing special characters (e.g. "C++", ".NET") are matched literally.
 */
export function matchKeywords(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;

  const lowerText = text.toLowerCase();
  
  return keywords.some(keyword => {
    const kw = keyword.toLowerCase().trim();
    if (!kw) return false;

    // Check if keyword is purely alphanumeric
    if (/^[a-zA-Z0-9]+$/.test(kw)) {
      // Use regex word boundaries (\b)
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(lowerText);
    } else {
      // Special characters present (e.g., C++, C#, .NET, Node.js)
      // Match literally or escape special characters for regex match
      const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      return lowerText.includes(kw) || regex.test(lowerText);
    }
  });
}
