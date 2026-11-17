/**
 * Il nome del prodotto, in un posto solo. GameStringer fa parte della suite
 * Rouges, dove le app si chiamano «Rouges@<Nome>» e si scrivono a due toni:
 * il prefisso in tono tenue, il nome in evidenza.
 *
 * Vale per i punti del MARCHIO (titolo della finestra, barra laterale,
 * schermata dei profili). Le frasi dell'interfaccia continuano a dire
 * «GameStringer», e i nomi interni (identificativo dell'app, cartelle dei
 * dati, cartella di lavoro nei giochi) non cambiano: da quelli dipendono i
 * dati salvati e le patch già installate.
 */
export const BRAND_PREFIX = 'Rouges@';
export const BRAND_NAME = 'Gamestringer';
export const BRAND_FULL = `${BRAND_PREFIX}${BRAND_NAME}`;
