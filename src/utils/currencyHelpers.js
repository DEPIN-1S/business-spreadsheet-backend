const SUPPORTED_CURRENCIES = [
    { code: "INR", symbol: "₹", locale: "en-IN" },
    { code: "USD", symbol: "$", locale: "en-US" },
    { code: "EUR", symbol: "€", locale: "de-DE" },
    { code: "GBP", symbol: "£", locale: "en-GB" },
    { code: "AED", symbol: "AED", locale: "ar-AE" },
    { code: "SAR", symbol: "SAR", locale: "ar-SA" },
    { code: "CAD", symbol: "CA$", locale: "en-CA" },
    { code: "AUD", symbol: "A$", locale: "en-AU" },
    { code: "SGD", symbol: "S$", locale: "en-SG" },
];

function formatCurrencyValue(numericValue, currencyCode) {
    if (numericValue === null || numericValue === undefined || isNaN(numericValue)) return null;
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode) || SUPPORTED_CURRENCIES[0];
    return new Intl.NumberFormat(currency.locale, {
        style: 'currency',
        currency: currency.code
    }).format(numericValue);
}

function parseCurrencyInput(rawInput) {
    if (rawInput === null || rawInput === undefined || rawInput === "") return "";
    if (typeof rawInput === 'number') return rawInput.toString();
    // Remove all non-numeric characters except '.' and '-'
    const cleaned = String(rawInput).replace(/[^0-9.-]+/g, "");
    return cleaned;
}

function normalizeCurrencyCell(rawValue, currencyCode) {
    const numericString = parseCurrencyInput(rawValue);
    if (!numericString) return { numericValue: null, currencyCode, formattedValue: "" };
    
    const numericValue = parseFloat(numericString);
    if (isNaN(numericValue)) return { numericValue: null, currencyCode, formattedValue: "" };

    return {
        numericValue,
        currencyCode,
        formattedValue: formatCurrencyValue(numericValue, currencyCode)
    };
}

function convertCurrency(value, fromCode, toCode, rate) {
    const numValue = parseFloat(value);
    const numRate = parseFloat(rate);
    if (isNaN(numValue) || isNaN(numRate)) return 0;
    return numValue * numRate;
}

export {
    SUPPORTED_CURRENCIES,
    formatCurrencyValue,
    parseCurrencyInput,
    normalizeCurrencyCell,
    convertCurrency
};
