import { describe, it, expect } from 'vitest';
import { buildTmx, type TmxEntry, type TmxOptions } from '@/lib/export/tmx';

const base: TmxOptions = {
  sourceLang: 'en',
  targetLang: 'ru',
  includeContext: true,
  includeNotes: true,
  includeEmpty: false,
};

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror').length).toBe(0);
  return doc;
}

describe('buildTmx', () => {
  it('usa la coppia di lingue reale per srclang e xml:lang', () => {
    const { content } = buildTmx([{ id: '1', source: 'Hello', target: 'Привет' }], base);
    const doc = parse(content);
    expect(doc.documentElement.getAttribute('version')).toBe('1.4');
    expect(doc.getElementsByTagName('header')[0].getAttribute('srclang')).toBe('en');
    const tuvs = doc.getElementsByTagName('tuv');
    expect(tuvs[0].getAttribute('xml:lang')).toBe('en');
    expect(tuvs[1].getAttribute('xml:lang')).toBe('ru');
    expect(tuvs[1].textContent).toBe('Привет');
  });

  it('senza includeEmpty salta le traduzioni vuote e conta solo le tu scritte', () => {
    const entries: TmxEntry[] = [
      { id: 'a', source: 'One', target: 'Uno' },
      { id: 'b', source: 'Two', target: '' },
      { id: 'c', source: 'Three', target: '   ' },
    ];
    const { content, count } = buildTmx(entries, base);
    expect(count).toBe(1);
    expect(parse(content).getElementsByTagName('tu').length).toBe(1);
  });

  it('con includeEmpty la voce non tradotta porta solo la tuv di origine', () => {
    const { content, count } = buildTmx([{ id: 'b', source: 'Two', target: '' }], { ...base, includeEmpty: true });
    expect(count).toBe(1);
    const tuvs = parse(content).getElementsByTagName('tuv');
    expect(tuvs.length).toBe(1);
    expect(tuvs[0].getAttribute('xml:lang')).toBe('en');
  });

  it('contesto e note seguono le opzioni', () => {
    const entry: TmxEntry = { id: '1', source: 'Hi', target: 'Ciao', context: 'menu', notes: 'short' };
    const on = parse(buildTmx([entry], base).content);
    expect(on.getElementsByTagName('note')[0].textContent).toBe('short');
    expect(on.getElementsByTagName('prop')[0].getAttribute('type')).toBe('x-context');
    expect(on.getElementsByTagName('prop')[0].textContent).toBe('menu');

    const off = parse(buildTmx([entry], { ...base, includeContext: false, includeNotes: false }).content);
    expect(off.getElementsByTagName('note').length).toBe(0);
    expect(off.getElementsByTagName('prop').length).toBe(0);
  });

  it('esegue l\'escape XML e resta un documento valido', () => {
    const source = `<b>Tom & "Jerry"</b>'s\r\nline\u0001`;
    const id = 'key<"&\'>\tx';
    const { content } = buildTmx([{ id, source, target: 'a < b && c > d' }], base);
    const doc = parse(content);
    expect(doc.getElementsByTagName('tu')[0].getAttribute('tuid')).toBe(id);
    const segs = doc.getElementsByTagName('seg');
    // Il carattere di controllo U+0001 non è ammesso in XML 1.0 e viene rimosso.
    expect(segs[0].textContent).toBe(`<b>Tom & "Jerry"</b>'s\r\nline`);
    expect(segs[1].textContent).toBe('a < b && c > d');
  });
});
