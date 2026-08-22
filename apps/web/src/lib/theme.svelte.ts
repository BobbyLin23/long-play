export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "long-play-theme";

function getSystemTheme(): ResolvedTheme {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
	return preference === "system" ? getSystemTheme() : preference;
}

function applyResolved(resolved: ResolvedTheme, preference: ThemePreference) {
	const root = document.documentElement;
	root.classList.remove("light", "dark");
	root.classList.add(resolved);
	root.dataset.theme = preference;
	root.style.colorScheme = resolved;
}

class ThemeController {
	preference = $state<ThemePreference>("system");
	resolved = $state<ResolvedTheme>("dark");
	#initialized = false;
	#media: MediaQueryList | null = null;

	init() {
		if (this.#initialized) return;
		this.#initialized = true;
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === "light" || stored === "dark" || stored === "system") {
			this.preference = stored;
		}
		this.#sync();
		this.#media = window.matchMedia("(prefers-color-scheme: dark)");
		this.#media.addEventListener("change", this.#onSystemChange);
	}

	set(preference: ThemePreference) {
		this.preference = preference;
		localStorage.setItem(THEME_STORAGE_KEY, preference);
		this.#sync();
	}

	#sync() {
		this.resolved = resolveTheme(this.preference);
		applyResolved(this.resolved, this.preference);
	}

	#onSystemChange = () => {
		if (this.preference === "system") this.#sync();
	};
}

export const theme = new ThemeController();
