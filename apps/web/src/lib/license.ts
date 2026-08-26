/** Format a CC (or equivalent) license URL for Album and Now Playing credit. */

export function formatLicense(
	license: string | null | undefined,
): string | null {
	if (!license?.trim()) return null;
	const value = license.trim();
	const cc0 = /publicdomain\/zero\/(\d+(?:\.\d+)?)/i.exec(value);
	if (cc0) return `CC0 ${cc0[1]}`;
	const cc = /licenses\/([a-z-]+)\/(\d+(?:\.\d+)?)/i.exec(value);
	if (cc) return `CC ${cc[1].toUpperCase()} ${cc[2]}`;
	return value;
}

export function licenseHref(license: string | null | undefined): string | null {
	if (!license?.trim()) return null;
	try {
		const url = new URL(license.trim());
		if (url.protocol === "http:" || url.protocol === "https:") return url.href;
	} catch {
		return null;
	}
	return null;
}
