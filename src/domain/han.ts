/** CJK ideograph ranges, including the common compatibility block. */
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

export function isHan(text: string): boolean {
  return HAN.test(text)
}
