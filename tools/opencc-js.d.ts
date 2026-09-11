/**
 * Minimal ambient types for `opencc-js`, which ships no declarations.
 * Only the converter factory used by the build-time data pipeline is declared.
 */
declare module 'opencc-js' {
    export interface ConverterOptions {
        from: string
        to: string
    }

    export type Converter = (text: string) => string

    export function Converter(options: ConverterOptions): Converter

    const OpenCC: {
        Converter: typeof Converter
    }

    export default OpenCC
}
