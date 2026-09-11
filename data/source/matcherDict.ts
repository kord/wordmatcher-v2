import {Lang} from "./languages";

const warnLength = 10;

export type WordEntry = {
    lang: Lang,
    word: string,
    definition?: string,
}

export class MatcherDict {
    name: string;

    lang1: Lang;
    lang2: Lang;

    entries: Array<[WordEntry, WordEntry]>;

    l1word: Map<string, WordEntry>;
    l2word: Map<string, WordEntry>;

    l1length: Map<number, WordEntry[]>;
    l2length: Map<number, WordEntry[]>;

    constructor(name: string, entries: Array<[WordEntry, WordEntry]>) {
        console.assert(entries.length > 10, 'Cannot initialize dictionary with a very short word list.');

        this.name = name;
        this.entries = entries;
        this.lang1 = entries[0][0].lang;
        this.lang2 = entries[0][1].lang;

        this.l1word = new Map();
        this.l2word = new Map();
        this.l1length = new Map();
        this.l2length = new Map();

        entries.forEach((entry, index) => {
            this.addPair(entry[0], entry[1]);
            MatcherDict.insertLength(entry[0], this.l1length);
            MatcherDict.insertLength(entry[1], this.l2length);
        });

        // Give notice at initialization if there are uncomfortably few entries for some length of words.
        // This is relevant for chinese since pinyin matching tries to find entries with the same length and we
        // need enough entries to populate the options.
        this.l1length.forEach((k, v) => {
            if (k.length < warnLength) console.error(`Length ${v} of lang ${Lang[k[0].lang]} only has ${k.length} entries.`);
        });
    }

    private static insertLength(word: WordEntry, list: Map<number, WordEntry[]>) {
        const length = word.word.length;
        if (list.has(length)) {
            list.get(length)!.push(word);
        } else {
            list.set(length, [word]);
        }
    }

    addPair = (a: WordEntry, b: WordEntry) => {
        console.assert(a.lang === this.lang1 && b.lang === this.lang2,
            `Inserting wrong languages into dictionary.`);
        this.l1word.set(a.word, b);
        this.l2word.set(b.word, a);

    }

    randomLength = (lang: Lang, length: number) => {
        let table : Map<number, WordEntry[]>;
        if (lang === this.lang1) table = this.l1length;
        else if (lang === this.lang2) table = this.l2length;
        else throw new Error('randomLength called for absent language.');

        const list = table!.get(length)!;

        if (list.length  < warnLength) {
            if (lang === this.lang1) return this.random()[0];
            else if (lang === this.lang2) return this.random()[1];

            throw new Error('not enough words of proper length AND absent language.');
        }
        const index = Math.floor(Math.random() * list.length);
        return list[index];
    }

    random = () => {
        const index = Math.floor(Math.random() * this.entries.length);
        return this.entries[index];
    }

}

