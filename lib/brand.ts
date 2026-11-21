/**
 * Il nome del prodotto, in un posto solo. GameStringer fa parte della suite
 * Rouges, dove le app si chiamano «Rouges-<Nome>» e si scrivono a due toni
 * come nel Launcher (ui/launcher.slint, AppName): il prefisso nel colore del
 * testo, il nome nel colore dell'app.
 *
 * Vale per i punti del MARCHIO (titolo della finestra, barra laterale,
 * schermata dei profili). Le frasi dell'interfaccia continuano a dire
 * «GameStringer», e i nomi interni (identificativo dell'app, cartelle dei
 * dati, cartella di lavoro nei giochi) non cambiano: da quelli dipendono i
 * dati salvati e le patch già installate.
 */
export const BRAND_PREFIX = 'Rouges-';
export const BRAND_NAME = 'GameStringer';
export const BRAND_FULL = `${BRAND_PREFIX}${BRAND_NAME}`;
