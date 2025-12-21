/**
 * Redaction utility for masking PII before sending text to the server.
 */

export interface RedactionSettings {
    emails: boolean;
    phones: boolean;
    urls: boolean;
    numbers: boolean;
}

const REGEX = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&//=]*)/g,
    // Long numbers like IDs (typically 8+ digits)
    numbers: /\b\d{8,}\b/g
};

export function redactText(text: string, settings: RedactionSettings): string {
    let redacted = text;

    if (settings.emails) {
        redacted = redacted.replace(REGEX.email, '[EMAIL]');
    }

    if (settings.phones) {
        redacted = redacted.replace(REGEX.phone, '[PHONE]');
    }

    if (settings.urls) {
        redacted = redacted.replace(REGEX.url, '[URL]');
    }

    if (settings.numbers) {
        redacted = redacted.replace(REGEX.numbers, '[ID]');
    }

    return redacted;
}
